'use client';

// ============================================================
// Types
// ============================================================

export interface ErrorBannerProps {
  /** Error message to display */
  message: string;
  /** Called when the retry button is clicked. If undefined, no retry button is shown. */
  onRetry?: () => void;
  /** Called when the dismiss/close button is clicked. If undefined, no dismiss button is shown. */
  onDismiss?: () => void;
  /** Visual variant */
  variant?: 'error' | 'warning';
}

// ============================================================
// Component
// ============================================================

/**
 * Generic error banner for displaying API errors inline with optional retry and dismiss.
 * Used for Financial API failures, general data loading errors, etc.
 */
export default function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  variant = 'error',
}: ErrorBannerProps) {
  const isWarning = variant === 'warning';
  const bgColor = isWarning ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
  const iconColor = isWarning ? 'text-yellow-500' : 'text-red-500';
  const textColor = isWarning ? 'text-yellow-800' : 'text-red-700';
  const btnBg = isWarning ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800' : 'bg-red-100 hover:bg-red-200 text-red-700';

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border rounded-lg ${bgColor}`}
      role="alert"
      data-testid="error-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className={`h-5 w-5 flex-shrink-0 ${iconColor}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          {isWarning ? (
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          ) : (
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          )}
        </svg>
        <p className={`text-sm ${textColor}`}>{message}</p>
      </div>

      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${btnBg}`}
            data-testid="retry-button"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1 rounded-md hover:bg-black/5 ${textColor}`}
            aria-label="Dismiss error"
            data-testid="dismiss-button"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
