import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WatchlistItem from './WatchlistItem';
import type { WatchlistItem as WatchlistItemType } from '../../store/slices/watchlistSlice';

function createItem(overrides: Partial<WatchlistItemType> = {}): WatchlistItemType {
  return {
    tickerSymbol: 'AAPL',
    tickerName: 'Apple Inc.',
    currentPrice: 175.5,
    priceChangeAmount: 2.3,
    priceChangePercent: 1.33,
    sparklineData: [170, 171, 172, 174, 173, 175, 175.5],
    ...overrides,
  };
}

function renderItem(
  itemOverrides: Partial<WatchlistItemType> = {},
  props: { onRemove?: (ticker: string) => void; onSelect?: (ticker: string) => void } = {}
) {
  const item = createItem(itemOverrides);
  const onRemove = props.onRemove ?? vi.fn();
  const onSelect = props.onSelect ?? vi.fn();

  const result = render(
    <WatchlistItem item={item} onRemove={onRemove} onSelect={onSelect} />
  );

  return {
    ...result,
    item,
    onRemove: onRemove as ReturnType<typeof vi.fn>,
    onSelect: onSelect as ReturnType<typeof vi.fn>,
  };
}

describe('WatchlistItem', () => {
  describe('rendering', () => {
    it('displays ticker symbol', () => {
      renderItem({ tickerSymbol: 'MSFT' });
      expect(screen.getByTestId('item-ticker')).toHaveTextContent('MSFT');
    });

    it('displays ticker name', () => {
      renderItem({ tickerName: 'Microsoft Corp.' });
      expect(screen.getByTestId('item-name')).toHaveTextContent('Microsoft Corp.');
    });

    it('displays current price formatted with dollar sign', () => {
      renderItem({ currentPrice: 420.69 });
      expect(screen.getByTestId('item-price')).toHaveTextContent('$420.69');
    });

    it('displays price change amount and percent', () => {
      renderItem({ priceChangeAmount: 2.3, priceChangePercent: 1.33 });
      expect(screen.getByTestId('item-change')).toHaveTextContent('+2.30');
      expect(screen.getByTestId('item-change')).toHaveTextContent('+1.33%');
    });

    it('displays negative price change', () => {
      renderItem({ priceChangeAmount: -5.25, priceChangePercent: -2.1 });
      const change = screen.getByTestId('item-change');
      expect(change).toHaveTextContent('-5.25');
      expect(change).toHaveTextContent('-2.10%');
    });

    it('applies green color for positive change', () => {
      renderItem({ priceChangeAmount: 1.0, priceChangePercent: 0.5 });
      const change = screen.getByTestId('item-change');
      expect(change).toHaveClass('text-green-600');
    });

    it('applies red color for negative change', () => {
      renderItem({ priceChangeAmount: -1.0, priceChangePercent: -0.5 });
      const change = screen.getByTestId('item-change');
      expect(change).toHaveClass('text-red-600');
    });

    it('renders sparkline', () => {
      renderItem({ sparklineData: [100, 101, 102, 103, 102, 104, 105] });
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('renders remove button', () => {
      renderItem({ tickerSymbol: 'VOO' });
      expect(screen.getByTestId('remove-VOO')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect when item is clicked', () => {
      const { onSelect } = renderItem({ tickerSymbol: 'AAPL' });

      fireEvent.click(screen.getByTestId('watchlist-item-AAPL'));

      expect(onSelect).toHaveBeenCalledWith('AAPL');
    });

    it('calls onSelect when Enter key is pressed', () => {
      const { onSelect } = renderItem({ tickerSymbol: 'AAPL' });

      fireEvent.keyDown(screen.getByTestId('watchlist-item-AAPL'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('AAPL');
    });

    it('calls onSelect when Space key is pressed', () => {
      const { onSelect } = renderItem({ tickerSymbol: 'AAPL' });

      fireEvent.keyDown(screen.getByTestId('watchlist-item-AAPL'), { key: ' ' });

      expect(onSelect).toHaveBeenCalledWith('AAPL');
    });

    it('calls onRemove when remove button is clicked', () => {
      const { onRemove } = renderItem({ tickerSymbol: 'MSFT' });

      fireEvent.click(screen.getByTestId('remove-MSFT'));

      expect(onRemove).toHaveBeenCalledWith('MSFT');
    });

    it('does not call onSelect when remove button is clicked', () => {
      const { onSelect } = renderItem({ tickerSymbol: 'MSFT' });

      fireEvent.click(screen.getByTestId('remove-MSFT'));

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has button role for item', () => {
      renderItem({ tickerSymbol: 'AAPL' });
      expect(screen.getByTestId('watchlist-item-AAPL')).toHaveAttribute('role', 'button');
    });

    it('has tabIndex for keyboard navigation', () => {
      renderItem({ tickerSymbol: 'AAPL' });
      expect(screen.getByTestId('watchlist-item-AAPL')).toHaveAttribute('tabindex', '0');
    });

    it('has accessible label for item', () => {
      renderItem({ tickerSymbol: 'AAPL' });
      expect(screen.getByLabelText('View chart for AAPL')).toBeInTheDocument();
    });

    it('has accessible label for remove button', () => {
      renderItem({ tickerSymbol: 'VOO' });
      expect(screen.getByLabelText('Remove VOO from watchlist')).toBeInTheDocument();
    });
  });

  describe('formatting', () => {
    it('formats price with two decimal places', () => {
      renderItem({ currentPrice: 100 });
      expect(screen.getByTestId('item-price')).toHaveTextContent('$100.00');
    });

    it('formats large prices with comma separators', () => {
      renderItem({ currentPrice: 1234.56 });
      expect(screen.getByTestId('item-price')).toHaveTextContent('$1,234.56');
    });

    it('formats zero change with plus sign', () => {
      renderItem({ priceChangeAmount: 0, priceChangePercent: 0 });
      const change = screen.getByTestId('item-change');
      expect(change).toHaveTextContent('+0.00');
      expect(change).toHaveTextContent('+0.00%');
    });
  });
});
