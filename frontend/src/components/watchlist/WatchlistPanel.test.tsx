import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import WatchlistPanel from './WatchlistPanel';
import watchlistReducer, {
  type WatchlistState,
  type WatchlistItem,
} from '../../store/slices/watchlistSlice';

// Mock fetch globally to prevent actual API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWatchlistItem(overrides: Partial<WatchlistItem> = {}): WatchlistItem {
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

const sampleItems: WatchlistItem[] = [
  createWatchlistItem({ tickerSymbol: 'AAPL', tickerName: 'Apple Inc.', currentPrice: 175.5, priceChangePercent: 1.33 }),
  createWatchlistItem({ tickerSymbol: 'MSFT', tickerName: 'Microsoft Corp.', currentPrice: 420.0, priceChangePercent: -0.5 }),
  createWatchlistItem({ tickerSymbol: 'VOO', tickerName: 'Vanguard S&P 500 ETF', currentPrice: 480.25, priceChangePercent: 0.75 }),
];

function createMockStore(watchlistState?: Partial<WatchlistState>) {
  return configureStore({
    reducer: {
      watchlist: watchlistReducer,
    },
    preloadedState: {
      watchlist: {
        items: sampleItems,
        sortBy: 'ticker',
        loading: false,
        error: null,
        ...watchlistState,
      },
    },
  });
}

function renderPanel(
  props: { onNavigateToChart?: (ticker: string) => void } = {},
  watchlistState?: Partial<WatchlistState>
) {
  const store = createMockStore(watchlistState);
  const onNavigateToChart = props.onNavigateToChart ?? vi.fn();

  const result = render(
    <Provider store={store}>
      <WatchlistPanel onNavigateToChart={onNavigateToChart} />
    </Provider>
  );

  return { ...result, store, onNavigateToChart: onNavigateToChart as ReturnType<typeof vi.fn> };
}

describe('WatchlistPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: fetchWatchlist returns the sample items
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(sampleItems),
    });
  });

  describe('rendering', () => {
    it('renders the panel with header', () => {
      renderPanel();
      expect(screen.getByText('Watchlist')).toBeInTheDocument();
      expect(screen.getByTestId('watchlist-panel')).toBeInTheDocument();
    });

    it('renders add ticker input and button', () => {
      renderPanel();
      expect(screen.getByTestId('ticker-input')).toBeInTheDocument();
      expect(screen.getByTestId('add-ticker-btn')).toBeInTheDocument();
    });

    it('renders sort controls', () => {
      renderPanel();
      expect(screen.getByTestId('sort-ticker')).toBeInTheDocument();
      expect(screen.getByTestId('sort-price')).toBeInTheDocument();
      expect(screen.getByTestId('sort-change')).toBeInTheDocument();
    });

    it('renders watchlist items', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-item-AAPL')).toBeInTheDocument();
      });
      expect(screen.getByTestId('watchlist-item-MSFT')).toBeInTheDocument();
      expect(screen.getByTestId('watchlist-item-VOO')).toBeInTheDocument();
    });

    it('renders empty state when no items', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      renderPanel({}, { items: [] });
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText(/Your watchlist is empty/)).toBeInTheDocument();
    });

    it('renders loading state', () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
      renderPanel({}, { items: [], loading: false });
      // After the pending action fires, loading becomes true
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText(/Loading watchlist/)).toBeInTheDocument();
    });

    it('renders API error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ code: 'API_ERROR', message: 'Failed to fetch watchlist', retryable: true }),
      });
      renderPanel({}, { items: sampleItems });
      await waitFor(() => {
        expect(screen.getByTestId('api-error')).toBeInTheDocument();
      });
    });
  });

  describe('adding a ticker', () => {
    it('shows validation error for empty input', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('add-ticker-btn'));

      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText('Please enter a ticker symbol.')).toBeInTheDocument();
    });

    it('shows validation error for invalid ticker format', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: '123' } });
      fireEvent.click(screen.getByTestId('add-ticker-btn'));

      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText('Ticker must be 1-5 uppercase letters.')).toBeInTheDocument();
    });

    it('shows validation error for ticker longer than 5 characters', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'ABCDEF' } });
      fireEvent.click(screen.getByTestId('add-ticker-btn'));

      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText('Ticker must be 1-5 uppercase letters.')).toBeInTheDocument();
    });

    it('shows duplicate error when ticker already exists', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByTestId('add-ticker-btn'));

      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText('AAPL is already in your watchlist.')).toBeInTheDocument();
    });

    it('shows duplicate error for case-insensitive match', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'aapl' } });
      fireEvent.click(screen.getByTestId('add-ticker-btn'));

      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      expect(screen.getByText('AAPL is already in your watchlist.')).toBeInTheDocument();
    });

    it('clears validation error when input changes', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      // Trigger error
      fireEvent.click(screen.getByTestId('add-ticker-btn'));
      expect(screen.getByTestId('validation-error')).toBeInTheDocument();

      // Change input
      fireEvent.change(screen.getByTestId('ticker-input'), { target: { value: 'G' } });
      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    });

    it('submits on Enter key press', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      const input = screen.getByTestId('ticker-input');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should trigger validation error for empty input
      expect(screen.getByTestId('validation-error')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts by ticker alphabetically by default', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-items')).toBeInTheDocument();
      });

      const itemsContainer = screen.getByTestId('watchlist-items');
      const items = itemsContainer.querySelectorAll('[data-testid^="watchlist-item-"]');

      expect(items[0]).toHaveAttribute('data-testid', 'watchlist-item-AAPL');
      expect(items[1]).toHaveAttribute('data-testid', 'watchlist-item-MSFT');
      expect(items[2]).toHaveAttribute('data-testid', 'watchlist-item-VOO');
    });

    it('sorts by price descending when price sort is clicked', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-items')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-price'));

      const itemsContainer = screen.getByTestId('watchlist-items');
      const items = itemsContainer.querySelectorAll('[data-testid^="watchlist-item-"]');

      // VOO: 480.25, MSFT: 420.0, AAPL: 175.5
      expect(items[0]).toHaveAttribute('data-testid', 'watchlist-item-VOO');
      expect(items[1]).toHaveAttribute('data-testid', 'watchlist-item-MSFT');
      expect(items[2]).toHaveAttribute('data-testid', 'watchlist-item-AAPL');
    });

    it('sorts by percent change descending when change sort is clicked', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-items')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('sort-change'));

      const itemsContainer = screen.getByTestId('watchlist-items');
      const items = itemsContainer.querySelectorAll('[data-testid^="watchlist-item-"]');

      // AAPL: 1.33%, VOO: 0.75%, MSFT: -0.5%
      expect(items[0]).toHaveAttribute('data-testid', 'watchlist-item-AAPL');
      expect(items[1]).toHaveAttribute('data-testid', 'watchlist-item-VOO');
      expect(items[2]).toHaveAttribute('data-testid', 'watchlist-item-MSFT');
    });

    it('highlights active sort button', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });

      const tickerBtn = screen.getByTestId('sort-ticker');
      expect(tickerBtn).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(screen.getByTestId('sort-price'));
      expect(screen.getByTestId('sort-price')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('sort-ticker')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('removing a ticker', () => {
    it('dispatches removeFromWatchlist when remove button is clicked', async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === 'DELETE') {
          return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(undefined) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(sampleItems) });
      });
      const { store } = renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-item-AAPL')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('remove-AAPL'));

      await waitFor(() => {
        const state = store.getState().watchlist;
        expect(state.items.find((i) => i.tickerSymbol === 'AAPL')).toBeUndefined();
      });
    });
  });

  describe('navigation', () => {
    it('calls onNavigateToChart when item is clicked', async () => {
      const onNavigateToChart = vi.fn();
      renderPanel({ onNavigateToChart });
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-item-AAPL')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('watchlist-item-AAPL'));

      expect(onNavigateToChart).toHaveBeenCalledWith('AAPL');
    });

    it('calls onNavigateToChart when item is activated via keyboard', async () => {
      const onNavigateToChart = vi.fn();
      renderPanel({ onNavigateToChart });
      await waitFor(() => {
        expect(screen.getByTestId('watchlist-item-MSFT')).toBeInTheDocument();
      });

      const item = screen.getByTestId('watchlist-item-MSFT');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(onNavigateToChart).toHaveBeenCalledWith('MSFT');
    });
  });

  describe('error dismissal', () => {
    it('can dismiss API error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ code: 'API_ERROR', message: 'Some error', retryable: true }),
      });
      renderPanel({}, { items: sampleItems });

      await waitFor(() => {
        expect(screen.getByTestId('api-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Dismiss error'));

      await waitFor(() => {
        expect(screen.queryByTestId('api-error')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('input has accessible label', () => {
      renderPanel();
      expect(screen.getByLabelText('Ticker symbol input')).toBeInTheDocument();
    });

    it('sort buttons have aria-pressed attribute', () => {
      renderPanel();
      expect(screen.getByTestId('sort-ticker')).toHaveAttribute('aria-pressed');
      expect(screen.getByTestId('sort-price')).toHaveAttribute('aria-pressed');
      expect(screen.getByTestId('sort-change')).toHaveAttribute('aria-pressed');
    });

    it('sort controls have group role with label', () => {
      renderPanel();
      expect(screen.getByRole('group', { name: 'Sort options' })).toBeInTheDocument();
    });

    it('watchlist items container has list role', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByRole('list', { name: 'Watchlist items' })).toBeInTheDocument();
      });
    });

    it('validation error has alert role', async () => {
      renderPanel();
      await waitFor(() => {
        expect(screen.getByTestId('add-ticker-btn')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByTestId('add-ticker-btn'));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
