import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ToastNotification from './ToastNotification';
import type { Toast } from '../../store/slices/uiSlice';

describe('ToastNotification', () => {
  const mockOnDismiss = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const makeToast = (overrides: Partial<Toast> = {}): Toast => ({
    id: 'toast-1',
    type: 'error',
    message: 'Something went wrong',
    retryable: false,
    ...overrides,
  });

  it('displays the toast message', () => {
    render(
      <ToastNotification toast={makeToast()} onDismiss={mockOnDismiss} />
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders dismiss button', () => {
    render(
      <ToastNotification toast={makeToast()} onDismiss={mockOnDismiss} />
    );
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    render(
      <ToastNotification toast={makeToast()} onDismiss={mockOnDismiss} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(mockOnDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('shows retry button when toast is retryable and onRetry provided', () => {
    render(
      <ToastNotification
        toast={makeToast({ retryable: true })}
        onDismiss={mockOnDismiss}
        onRetry={mockOnRetry}
      />
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not show retry button when toast is not retryable', () => {
    render(
      <ToastNotification
        toast={makeToast({ retryable: false })}
        onDismiss={mockOnDismiss}
        onRetry={mockOnRetry}
      />
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('auto-dismisses success toasts after 5 seconds', () => {
    render(
      <ToastNotification
        toast={makeToast({ type: 'success', message: 'Saved!' })}
        onDismiss={mockOnDismiss}
      />
    );

    expect(mockOnDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockOnDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('does not auto-dismiss error toasts', () => {
    render(
      <ToastNotification
        toast={makeToast({ type: 'error' })}
        onDismiss={mockOnDismiss}
      />
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('has alert role for accessibility', () => {
    render(
      <ToastNotification toast={makeToast()} onDismiss={mockOnDismiss} />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders different styles for different toast types', () => {
    const { rerender } = render(
      <ToastNotification toast={makeToast({ type: 'success' })} onDismiss={mockOnDismiss} />
    );
    const alertEl = screen.getByRole('alert');
    expect(alertEl.className).toContain('bg-green-50');

    rerender(
      <ToastNotification toast={makeToast({ type: 'warning' })} onDismiss={mockOnDismiss} />
    );
    expect(screen.getByRole('alert').className).toContain('bg-yellow-50');
  });
});
