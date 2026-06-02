import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChartErrorBanner from './ChartErrorBanner';

describe('ChartErrorBanner', () => {
  const mockOnRetry = vi.fn();

  it('displays the error message', () => {
    render(
      <ChartErrorBanner message="Failed to load stock data" onRetry={mockOnRetry} />
    );

    expect(screen.getByText('Failed to load stock data')).toBeInTheDocument();
  });

  it('renders a retry button', () => {
    render(
      <ChartErrorBanner message="Network error" onRetry={mockOnRetry} />
    );

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    render(
      <ChartErrorBanner message="API unavailable" onRetry={mockOnRetry} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('has alert role for accessibility', () => {
    render(
      <ChartErrorBanner message="Something went wrong" onRetry={mockOnRetry} />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays different error messages correctly', () => {
    const { rerender } = render(
      <ChartErrorBanner message="Financial API is unavailable" onRetry={mockOnRetry} />
    );

    expect(screen.getByText('Financial API is unavailable')).toBeInTheDocument();

    rerender(
      <ChartErrorBanner message="Connection timeout" onRetry={mockOnRetry} />
    );

    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    expect(screen.queryByText('Financial API is unavailable')).not.toBeInTheDocument();
  });
});
