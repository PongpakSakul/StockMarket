import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionDetailPanel from './TransactionDetailPanel';
import type { BuyPoint } from '@/store/slices/chartSlice';

const mockBuyPoint: BuyPoint = {
  date: '2024-01-15',
  pricePerShare: 425.5,
  shares: 2.345678,
  totalAmount: 997.82,
  transactionCount: 1,
};

const mockAggregatedBuyPoint: BuyPoint = {
  date: '2024-03-20',
  pricePerShare: 150.25,
  shares: 10.123456,
  totalAmount: 1521.0,
  transactionCount: 3,
};

describe('TransactionDetailPanel', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when buyPoint is null', () => {
    const { container } = render(
      <TransactionDetailPanel
        buyPoint={null}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders panel when visible with a buyPoint', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('transaction-detail-panel')).toBeInTheDocument();
  });

  it('displays the Transaction Details header', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Transaction Details')).toBeInTheDocument();
  });

  it('displays the purchase date', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('displays shares with 6 decimal places', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('2.345678')).toBeInTheDocument();
  });

  it('displays price per share formatted as currency', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('$425.50')).toBeInTheDocument();
  });

  it('displays total investment formatted as currency', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('$997.82')).toBeInTheDocument();
  });

  it('has a close button', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('panel-close-button')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByTestId('panel-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show aggregated transaction info for single transaction', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText(/transactions on the same date/)).not.toBeInTheDocument();
  });

  it('shows transaction count for aggregated buy points', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockAggregatedBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/transactions on the same date/)).toBeInTheDocument();
  });

  it('has role dialog for accessibility', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Transaction Details')).toBeInTheDocument();
  });

  it('slides in from the right side (has fixed positioning)', () => {
    render(
      <TransactionDetailPanel
        buyPoint={mockBuyPoint}
        visible={true}
        onClose={vi.fn()}
      />
    );
    const panel = screen.getByTestId('transaction-detail-panel');
    expect(panel.className).toContain('fixed');
    expect(panel.className).toContain('right-0');
  });
});
