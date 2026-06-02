import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import BuyPointTooltip from './BuyPointTooltip';
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

describe('BuyPointTooltip', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={false}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders tooltip when visible', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByTestId('buy-point-tooltip')).toBeInTheDocument();
  });

  it('displays the purchase date', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('displays shares with 6 decimal places', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByText('2.345678')).toBeInTheDocument();
  });

  it('displays price per share with dollar sign and 2 decimal places', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByText('$425.50')).toBeInTheDocument();
  });

  it('displays total amount with dollar sign and 2 decimal places', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByText('$997.82')).toBeInTheDocument();
  });

  it('does not show transaction count for single transaction', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.queryByText('Transactions:')).not.toBeInTheDocument();
  });

  it('shows transaction count when multiple transactions on same date', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockAggregatedBuyPoint}
        visible={true}
        position={{ x: 100, y: 200 }}
      />
    );
    expect(screen.getByText('Transactions:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('positions tooltip at the specified coordinates', () => {
    render(
      <BuyPointTooltip
        buyPoint={mockBuyPoint}
        visible={true}
        position={{ x: 150, y: 250 }}
      />
    );
    const tooltip = screen.getByTestId('buy-point-tooltip');
    expect(tooltip.style.left).toBe('150px');
    expect(tooltip.style.top).toBe('250px');
  });

  it('accepts a container ref for boundary detection', () => {
    const containerRef = createRef<HTMLDivElement>();
    const { container } = render(
      <div ref={containerRef} style={{ width: 800, height: 400 }}>
        <BuyPointTooltip
          buyPoint={mockBuyPoint}
          visible={true}
          position={{ x: 100, y: 100 }}
          containerRef={containerRef}
        />
      </div>
    );
    expect(container.querySelector('[data-testid="buy-point-tooltip"]')).toBeInTheDocument();
  });
});
