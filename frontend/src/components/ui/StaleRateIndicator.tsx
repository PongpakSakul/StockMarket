'use client';

// ============================================================
// Types
// ============================================================

export interface StaleRateIndicatorProps {
  /** The cached exchange rate value */
  rate: number;
  /** When the rate was last fetched (ISO string) */
  fetchedAt: string;
  /** Callback to retry fetching the rate */
  onRetry?: () => void;
}

// ============================================================
// Component
// ============================================================

/**
 * Displays a stale exchange rate indicator when the Exchange Rate API
 * fails and a cached rate is being used instead.
 */
export default function StaleRateIndicator({ rate, fetchedAt, onRetry }: StaleRateIndicatorProps) {
  const formattedDate = new Date(fetchedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-1.5"
      role="status"
      aria-label="Exchange rate is stale"
      data-testid="stale-rate-indicator"
    >
      <svg
        className="h-4 w-4 text-yellow-600 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>

      <span className="text-xs text-yellow-800">
        <span className="font-medium">USD/THB: {rate.toFixed(2)}</span>
        <span className="ml-1 text-yellow-600">(cached from {formattedDate})</span>
      </span>

      <span className="inline-flex items-center rounded-full bg-yellow-200 px-1.5 py-0.5 text-xs font-medium text-yellow-900">
        Stale
      </span>

      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 text-xs font-medium text-yellow-700 underline hover:no-underline"
          aria-label="Refresh exchange rate"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
