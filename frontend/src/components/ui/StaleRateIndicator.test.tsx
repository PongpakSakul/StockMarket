import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StaleRateIndicator from './StaleRateIndicator';

describe('StaleRateIndicator', () => {
  const defaultProps = {
    rate: 35.1234,
    fetchedAt: '2024-01-15T10:30:00.000Z',
  };

  it('displays the cached exchange rate', () => {
    render(<StaleRateIndicator {...defaultProps} />);
    expect(screen.getByText(/USD\/THB: 35\.1234/)).toBeInTheDocument();
  });

  it('shows Stale badge', () => {
    render(<StaleRateIndicator {...defaultProps} />);
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('shows when the rate was fetched', () => {
    render(<StaleRateIndicator {...defaultProps} />);
    // The formatted date should contain the month and day
    expect(screen.getByText(/cached from/)).toBeInTheDocument();
  });

  it('renders a refresh button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<StaleRateIndicator {...defaultProps} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Refresh exchange rate' })).toBeInTheDocument();
  });

  it('calls onRetry when refresh button is clicked', () => {
    const onRetry = vi.fn();
    render(<StaleRateIndicator {...defaultProps} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh exchange rate' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render refresh button when onRetry is not provided', () => {
    render(<StaleRateIndicator {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Refresh exchange rate' })).not.toBeInTheDocument();
  });

  it('has status role for accessibility', () => {
    render(<StaleRateIndicator {...defaultProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
