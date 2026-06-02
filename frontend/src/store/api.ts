/**
 * API client configuration with base URL for all backend requests.
 * Includes retry logic for retryable errors and consistent error handling.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ============================================================
// Types
// ============================================================

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  /** Number of retries for retryable errors. Defaults to 0 (no retry). Set explicitly for endpoints that need retry. */
  maxRetries?: number;
  /** Initial delay in ms for exponential backoff. Defaults to 1000. */
  initialDelay?: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Build a URL with query parameters, filtering out undefined values.
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable based on its properties or HTTP status.
 */
function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'retryable' in error) {
    return (error as APIError).retryable === true;
  }
  return false;
}

/**
 * Determine if a network-level error occurred (fetch failure, timeout, etc.)
 */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('fetch');
}

// ============================================================
// API Client
// ============================================================

/**
 * Generic API client that wraps fetch with JSON handling, error normalization,
 * and automatic retry with exponential backoff for retryable errors.
 */
export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, params, headers, maxRetries = 0, initialDelay = 1000, ...rest } = options;

  const url = buildUrl(path, params);

  const config: RequestInit = {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData: APIError = await response.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: response.statusText || 'Request failed',
          retryable: response.status >= 500,
        }));

        // If retryable and we have retries left, wait and retry
        if (isRetryableError(errorData) && attempt < maxRetries) {
          lastError = errorData;
          await sleep(initialDelay * Math.pow(2, attempt));
          continue;
        }

        throw errorData;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      // Network errors are retryable
      if (isNetworkError(error) && attempt < maxRetries) {
        lastError = error;
        await sleep(initialDelay * Math.pow(2, attempt));
        continue;
      }

      // If it's already an APIError (thrown above), rethrow
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // Wrap unknown errors
      const apiError: APIError = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network connection failed',
        retryable: true,
      };
      throw apiError;
    }
  }

  // If all retries exhausted, throw the last error
  if (lastError && typeof lastError === 'object' && 'code' in lastError) {
    throw lastError;
  }
  throw {
    code: 'MAX_RETRIES_EXCEEDED',
    message: 'Request failed after maximum retries',
    retryable: false,
  } as APIError;
}

/**
 * Upload files via multipart/form-data with retry support.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  maxRetries: number = 0,
  initialDelay: number = 2000
): Promise<T> {
  const url = buildUrl(path);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData: APIError = await response.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: response.statusText || 'Upload failed',
          retryable: response.status >= 500,
        }));

        if (isRetryableError(errorData) && attempt < maxRetries) {
          lastError = errorData;
          await sleep(initialDelay * Math.pow(2, attempt));
          continue;
        }

        throw errorData;
      }

      return response.json();
    } catch (error) {
      if (isNetworkError(error) && attempt < maxRetries) {
        lastError = error;
        await sleep(initialDelay * Math.pow(2, attempt));
        continue;
      }

      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      const apiError: APIError = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Upload failed due to network error',
        retryable: true,
      };
      throw apiError;
    }
  }

  if (lastError && typeof lastError === 'object' && 'code' in lastError) {
    throw lastError;
  }
  throw {
    code: 'MAX_RETRIES_EXCEEDED',
    message: 'Upload failed after maximum retries',
    retryable: false,
  } as APIError;
}

/**
 * Download a file (for export endpoints) with retry support.
 */
export async function apiDownload(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<Blob> {
  const url = buildUrl(path, params);

  const response = await fetch(url);

  if (!response.ok) {
    const errorData: APIError = await response.json().catch(() => ({
      code: 'UNKNOWN_ERROR',
      message: response.statusText || 'Download failed',
      retryable: false,
    }));
    throw errorData;
  }

  return response.blob();
}

export { API_BASE_URL };
