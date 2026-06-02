/**
 * Redux middleware that intercepts rejected async thunks and dispatches
 * toast notifications for error handling.
 */

import { isRejected, Middleware } from '@reduxjs/toolkit';
import { addToast } from './slices/uiSlice';
import type { APIError } from './api';

/**
 * Maps API error codes to user-friendly messages.
 */
const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  MAX_RETRIES_EXCEEDED: 'Request failed after multiple attempts. Please try again later.',
  INVALID_TICKER: 'Invalid ticker symbol. Please enter a valid stock or ETF ticker.',
  INVALID_DATE: 'Invalid date. Please enter a valid date that is not in the future.',
  INVALID_AMOUNT: 'Invalid amount. Price and shares must be positive numbers.',
  FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
  UNSUPPORTED_FORMAT: 'Unsupported file format. Only JPG and PNG images are accepted.',
  OCR_FAILED: 'Unable to read the uploaded image. You can enter the transaction manually.',
  PARSE_INCOMPLETE: 'Some fields could not be extracted. Please fill in the missing information.',
  API_UNAVAILABLE: 'Financial data service is temporarily unavailable. Please try again.',
  FX_RATE_UNAVAILABLE: 'Exchange rate service is unavailable. Showing last known rate.',
  DB_WRITE_FAILED: 'Failed to save data. Please try again.',
  DUPLICATE_WATCHLIST: 'This stock is already in your watchlist.',
  BATCH_LIMIT_EXCEEDED: 'Too many files. Maximum 20 files per upload.',
  IMPORT_DUPLICATE: 'Some transactions already exist in the system.',
};

/**
 * Error codes that should NOT show a toast (handled by specific components instead).
 */
const SUPPRESSED_TOAST_CODES = new Set([
  'PARSE_INCOMPLETE', // Handled by ConfirmationModal
  'IMPORT_DUPLICATE', // Handled by DimeImportDialog
]);

/**
 * Extracts the APIError from a rejected action payload.
 */
function extractAPIError(action: { meta?: { rejectedWithValue?: boolean }; error?: { message?: string; code?: string }; payload?: unknown }): APIError | null {
  // If the thunk used rejectWithValue, the error is in payload
  if (action.meta?.rejectedWithValue && action.payload && typeof action.payload === 'object' && 'code' in action.payload) {
    return action.payload as APIError;
  }

  // Check the serialized error message (when error is thrown directly from thunk)
  if (action.error?.message) {
    try {
      // When an object is thrown (not an Error), RTK may serialize the message
      const parsed = JSON.parse(action.error.message);
      if (parsed && typeof parsed === 'object' && 'code' in parsed) {
        return parsed as APIError;
      }
    } catch {
      // Not a JSON error message
    }

    // Plain Error message — return as generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: action.error.message,
      retryable: false,
    };
  }

  return null;
}

/**
 * Middleware that listens for rejected async thunks and dispatches toast notifications.
 */
export const errorMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  if (isRejected(action)) {
    const typedAction = action as {
      meta?: { rejectedWithValue?: boolean };
      error?: { message?: string; code?: string };
      payload?: unknown;
    };
    const apiError = extractAPIError(typedAction);

    if (apiError && !SUPPRESSED_TOAST_CODES.has(apiError.code)) {
      const message = ERROR_MESSAGES[apiError.code] || apiError.message || 'An unexpected error occurred.';

      store.dispatch(
        addToast({
          type: 'error',
          message,
          retryable: apiError.retryable,
        })
      );
    }
  }

  return result;
};
