import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import chartReducer, { type TickerSearchResult } from '@/store/slices/chartSlice';
import transactionsReducer from '@/store/slices/transactionsSlice';
import portfolioReducer from '@/store/slices/portfolioSlice';
import dividendsReducer from '@/store/slices/dividendsSlice';
import watchlistReducer from '@/store/slices/watchlistSlice';
import exchangeRateReducer from '@/store/slices/exchangeRateSlice';
import uiReducer from '@/store/slices/uiSlice';
import TickerSearch from './TickerSearch';

const mockSearchResults: TickerSearchResult[] = [
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', exchange: 'NYSE' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', exchange: 'NYSE' },
];

// Mock the API client to return search results
vi.mock('@/store/api', () => ({
  apiClient: vi.fn().mockResolvedValue([]),
  API_BASE_URL: 'http://localhost:3001/api',
}));

// Import the mocked module so we can change its behavior per test
import { apiClient } from '@/store/api';
const mockApiClient = vi.mocked(apiClient);

const defaultChartState = {
  selectedTicker: null,
  timeRange: '1Y' as const,
  priceData: [],
  buyPoints: [],
  stockInfo: null,
  searchResults: [] as TickerSearchResult[],
  loading: false,
  error: null,
};

import newsReducer from '@/store/slices/newsSlice';

function createTestStore() {
  return configureStore({
    reducer: {
      chart: chartReducer,
      transactions: transactionsReducer,
      portfolio: portfolioReducer,
      dividends: dividendsReducer,
      watchlist: watchlistReducer,
      exchangeRate: exchangeRateReducer,
      ui: uiReducer,
      news: newsReducer,
    } as any,
    preloadedState: {
      chart: { ...defaultChartState },
    } as never,
  });
}

function renderWithStore(ui: React.ReactElement) {
  const store = createTestStore();
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe('TickerSearch', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.mockResolvedValue([]);
  });

  describe('basic rendering', () => {
    it('renders search input with placeholder', () => {
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);
      expect(screen.getByPlaceholderText('Search ticker symbol...')).toBeInTheDocument();
    });

    it('has accessible label on input', () => {
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);
      expect(screen.getByLabelText('Search ticker symbol')).toBeInTheDocument();
    });
  });

  describe('debounce behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows loading indicator while searching', () => {
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'VOO' } });

      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    });

    it('debounces search input by 300ms', async () => {
      const { store } = renderWithStore(<TickerSearch onSelect={mockOnSelect} />);
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'V' } });
      fireEvent.change(input, { target: { value: 'VO' } });
      fireEvent.change(input, { target: { value: 'VOO' } });

      // Before 300ms, no async thunk should have been dispatched
      const thunksBefore = dispatchSpy.mock.calls.filter(
        (call) => typeof call[0] === 'function'
      );
      expect(thunksBefore.length).toBe(0);

      // After 300ms, the search thunk should fire
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      const thunksAfter = dispatchSpy.mock.calls.filter(
        (call) => typeof call[0] === 'function'
      );
      expect(thunksAfter.length).toBeGreaterThan(0);
    });

    it('does not search when input is empty', () => {
      const { store } = renderWithStore(<TickerSearch onSelect={mockOnSelect} />);
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: '' } });

      vi.advanceTimersByTime(300);

      const thunkDispatches = dispatchSpy.mock.calls.filter(
        (call) => typeof call[0] === 'function'
      );
      expect(thunkDispatches.length).toBe(0);
    });
  });

  describe('dropdown behavior', () => {
    it('shows dropdown with search results', async () => {
      mockApiClient.mockResolvedValue(mockSearchResults);
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'V' } });

      await waitFor(() => {
        expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
        expect(screen.getByText('VOO')).toBeInTheDocument();
        expect(screen.getByText('VTI')).toBeInTheDocument();
      });
    });

    it('shows no results message when search returns empty', async () => {
      mockApiClient.mockResolvedValue([]);
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'ZZZZZ' } });

      await waitFor(() => {
        expect(screen.getByTestId('no-results')).toBeInTheDocument();
        expect(screen.getByText('No results found')).toBeInTheDocument();
      });
    });

    it('calls onSelect when a result is clicked', async () => {
      mockApiClient.mockResolvedValue(mockSearchResults.slice(0, 1));
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'VOO' } });

      await waitFor(() => {
        expect(screen.getByText('VOO')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('option'));
      expect(mockOnSelect).toHaveBeenCalledWith('VOO');
    });

    it('closes dropdown when clicking outside', async () => {
      mockApiClient.mockResolvedValue(mockSearchResults);
      renderWithStore(<TickerSearch onSelect={mockOnSelect} />);

      const input = screen.getByLabelText('Search ticker symbol');
      fireEvent.change(input, { target: { value: 'VOO' } });

      await waitFor(() => {
        expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
      });
    });
  });
});
