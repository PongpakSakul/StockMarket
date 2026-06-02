import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBanner from './ErrorBanner';

describe('ErrorBanner', () => {
  it('displays the error message', () => {
    render(<ErrorBanner message="Financial API is unavailable" />);
    expect(screen.getByText('Financial API is unavailable')).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Failed to load" onRetry={onRetry} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorBanner message="Failed to load" />);
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Failed to load" onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Error" onDismiss={onDismiss} />);
    expect(screen.getByTestId('dismiss-button')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Error" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has alert role for accessibility', () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders warning variant with yellow colors', () => {
    render(<ErrorBanner message="Rate may be outdated" variant="warning" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-yellow-50');
  });

  it('renders error variant with red colors by default', () => {
    render(<ErrorBanner message="Something broke" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-red-50');
  });
});
