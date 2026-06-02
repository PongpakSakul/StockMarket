'use client';

import { useEffect, useCallback } from 'react';
import type { Toast } from '../../store/slices/uiSlice';

// ============================================================
// Types
// ============================================================

export interface ToastNotificationProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  onRetry?: () => void;
}

// ============================================================
// Constants
// ============================================================

const AUTO_DISMISS_MS = 5000;

const TOAST_STYLES: Record<Toast['type'], { bg: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    text: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-500',
    text: 'text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
};

// ============================================================
// Icons
// ============================================================

function SuccessIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function InfoIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const ICONS: Record<Toast['type'], React.ComponentType<{ className: string }>> = {
  success: SuccessIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

// ============================================================
// Component
// ============================================================

export default function ToastNotification({ toast, onDismiss, onRetry }: ToastNotificationProps) {
  const styles = TOAST_STYLES[toast.type];
  const Icon = ICONS[toast.type];

  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  // Auto-dismiss non-error toasts
  useEffect(() => {
    if (toast.type !== 'error') {
      const timer = setTimeout(handleDismiss, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [toast.type, handleDismiss]);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${styles.bg}`}
      role="alert"
      aria-live="polite"
      data-testid={`toast-${toast.id}`}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${styles.text}`}>{toast.message}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {toast.retryable && onRetry && (
          <button
            onClick={onRetry}
            className={`text-sm font-medium underline hover:no-underline ${styles.text}`}
            aria-label="Retry"
          >
            Retry
          </button>
        )}
        <button
          onClick={handleDismiss}
          className={`p-1 rounded-md hover:bg-black/5 ${styles.text}`}
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
