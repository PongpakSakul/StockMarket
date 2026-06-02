import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api';
import type { APIError } from '../api';

// ============================================================
// Types
// ============================================================

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BuyPoint {
  date: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  transactionCount: number;
}

export interface StockInfo {
  ticker: string;
  name: string;
  type: 'stock' | 'etf';
  exchange: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  marketCap?: number;
}

export interface TickerSearchResult {
  ticker: string;
  name: string;
  type: 'stock' | 'etf';
  exchange: string;
}

export interface ChartState {
  selectedTicker: string | null;
  timeRange: TimeRange;
  priceData: OHLCData[];
  buyPoints: BuyPoint[];
  stockInfo: StockInfo | null;
  searchResults: TickerSearchResult[];
  loading: boolean;
  error: string | null;
  errorCode: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: ChartState = {
  selectedTicker: null,
  timeRange: '1Y',
  priceData: [],
  buyPoints: [],
  stockInfo: null,
  searchResults: [],
  loading: false,
  error: null,
  errorCode: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchStockPrices = createAsyncThunk<
  OHLCData[],
  { ticker: string; range: TimeRange },
  { rejectValue: APIError }
>(
  'chart/fetchStockPrices',
  async ({ ticker, range }, { rejectWithValue }) => {
    try {
      return await apiClient<OHLCData[]>(`/stocks/${ticker}/prices`, {
        params: { range },
        maxRetries: 3,
        initialDelay: 1000,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const fetchStockInfo = createAsyncThunk<
  StockInfo,
  string,
  { rejectValue: APIError }
>(
  'chart/fetchStockInfo',
  async (ticker, { rejectWithValue }) => {
    try {
      return await apiClient<StockInfo>(`/stocks/${ticker}/info`);
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const searchTickers = createAsyncThunk<
  TickerSearchResult[],
  string,
  { rejectValue: APIError }
>(
  'chart/searchTickers',
  async (query, { rejectWithValue }) => {
    try {
      return await apiClient<TickerSearchResult[]>('/stocks/search', {
        params: { q: query },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const fetchBuyPoints = createAsyncThunk<
  BuyPoint[],
  string,
  { rejectValue: APIError }
>(
  'chart/fetchBuyPoints',
  async (ticker, { rejectWithValue }) => {
    try {
      return await apiClient<BuyPoint[]>(`/transactions/buy-points/${ticker}`);
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const chartSlice = createSlice({
  name: 'chart',
  initialState,
  reducers: {
    setSelectedTicker(state, action: PayloadAction<string | null>) {
      state.selectedTicker = action.payload;
    },
    setTimeRange(state, action: PayloadAction<TimeRange>) {
      state.timeRange = action.payload;
    },
    clearSearchResults(state) {
      state.searchResults = [];
    },
    clearChartError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchStockPrices
    builder
      .addCase(fetchStockPrices.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(fetchStockPrices.fulfilled, (state, action) => {
        state.loading = false;
        state.priceData = action.payload;
      })
      .addCase(fetchStockPrices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch stock prices';
        state.errorCode = action.payload?.code || null;
      });

    // fetchStockInfo
    builder
      .addCase(fetchStockInfo.fulfilled, (state, action) => {
        state.stockInfo = action.payload;
      });

    // searchTickers
    builder
      .addCase(searchTickers.fulfilled, (state, action) => {
        state.searchResults = action.payload;
      });

    // fetchBuyPoints
    builder
      .addCase(fetchBuyPoints.fulfilled, (state, action) => {
        state.buyPoints = action.payload;
      });
  },
});

export const { setSelectedTicker, setTimeRange, clearSearchResults, clearChartError } = chartSlice.actions;
export default chartSlice.reducer;
