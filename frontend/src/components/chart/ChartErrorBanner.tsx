'use client';

export interface ChartErrorBannerProps {
  message: string;
  onRetry: () => void;
}

export default function ChartErrorBanner({ message, onRetry }: ChartErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-200 rounded-lg"
      role="alert"
    >
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-red-500 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm text-red-700">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
