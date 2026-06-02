import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CurrencyToggle, { type CurrencyToggleProps } from './CurrencyToggle';

function renderToggle(props: Partial<CurrencyToggleProps> = {}) {
  const defaultProps: CurrencyToggleProps = {
    currency: 'USD',
    onChange: vi.fn(),
    ...props,
  };
  return { ...render(<CurrencyToggle {...defaultProps} />), onChange: defaultProps.onChange };
}

describe('CurrencyToggle', () => {
  it('renders USD and THB buttons', () => {
    renderToggle();

    expect(screen.getByRole('button', { name: 'USD' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'THB' })).toBeInTheDocument();
  });

  it('has proper group role with accessible label', () => {
    renderToggle();

    expect(screen.getByRole('group', { name: 'Currency display toggle' })).toBeInTheDocument();
  });

  it('marks USD button as pressed when currency is USD', () => {
    renderToggle({ currency: 'USD' });

    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'THB' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks THB button as pressed when currency is THB', () => {
    renderToggle({ currency: 'THB' });

    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'THB' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('highlights active USD button with blue background', () => {
    renderToggle({ currency: 'USD' });

    expect(screen.getByRole('button', { name: 'USD' })).toHaveClass('bg-blue-600', 'text-white');
    expect(screen.getByRole('button', { name: 'THB' })).toHaveClass('bg-white', 'text-gray-700');
  });

  it('highlights active THB button with blue background', () => {
    renderToggle({ currency: 'THB' });

    expect(screen.getByRole('button', { name: 'THB' })).toHaveClass('bg-blue-600', 'text-white');
    expect(screen.getByRole('button', { name: 'USD' })).toHaveClass('bg-white', 'text-gray-700');
  });

  it('calls onChange with USD when USD button is clicked', () => {
    const { onChange } = renderToggle({ currency: 'THB' });

    fireEvent.click(screen.getByRole('button', { name: 'USD' }));

    expect(onChange).toHaveBeenCalledWith('USD');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange with THB when THB button is clicked', () => {
    const { onChange } = renderToggle({ currency: 'USD' });

    fireEvent.click(screen.getByRole('button', { name: 'THB' }));

    expect(onChange).toHaveBeenCalledWith('THB');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('calls onChange even when clicking the already active button', () => {
    const { onChange } = renderToggle({ currency: 'USD' });

    fireEvent.click(screen.getByRole('button', { name: 'USD' }));

    expect(onChange).toHaveBeenCalledWith('USD');
  });
});
