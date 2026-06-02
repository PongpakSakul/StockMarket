import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../api';
import type { APIError } from '../api';
import type { TimeRange } from './chartSlice';

// ============================================================
// Types
// ============================================================

export interface ExchangeRate {
  currencyPair: string;
  rate: number;
  fetchedAt: string;
  isStale: boolean;
}

export interface Holding {
  tickerSymbol: string;
  tickerName: string;
  totalShares: number;
  averageCostBasis: number;
  currentPrice: number;
  currentValueUSD: number;
  unrealizedPLUSD: number;
  unrealizedPLPercent: number;
  allocationPercent: number;
  totalDividends: number;
  totalReturnUSD: number;
  totalReturnPercent: number;
}

export interface PortfolioSummary {
  totalValueUSD: number;
  totalValueTHB: number;
  totalCostBasis: number;
  unrealizedPLUSD: number;
  unrealizedPLTHB: number;
  unrealizedPLPercent: number;
  totalDividendsReceived: number;
  totalReturnUSD: number;
  totalReturnPercent: number;
  dividendYieldPercent: number;
  exchangeRate: ExchangeRate;
  holdings: Holding[];
}

export interface AssetAllocation {
  tickerSymbol: string;
  tickerName: string;
  valueUSD: number;
  percentage: number;
}

export interface PerformanceDataPoint {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface PerformanceData {
  range: TimeRange;
  benchmark: string;
  dataPoints: PerformanceDataPoint[];
  portfolioTotalReturn: number;
  benchmarkTotalReturn: number;
}

export interface PortfolioState {
  summary: PortfolioSummary | null;
  allocation: AssetAllocation[];
  performance: PerformanceData | null;
  loading: boolean;
  error: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: PortfolioState = {
  summary: null,
  allocation: [],
  performance: null,
  loading: false,
  error: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchPortfolioSummary = createAsyncThunk<
  PortfolioSummary,
  void,
  { rejectValue: APIError }
>(
  'portfolio/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      return await apiClient<PortfolioSummary>('/portfolio/summary');
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const fetchAssetAllocation = createAsyncThunk<
  AssetAllocation[],
  void,
  { rejectValue: APIError }
>(
  'portfolio/fetchAllocation',
  async (_, { rejectWithValue }) => {
    try {
      return await apiClient<AssetAllocation[]>('/portfolio/allocation');
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const fetchPortfolioPerformance = createAsyncThunk<
  PerformanceData,
  { range: TimeRange; benchmark?: string },
  { rejectValue: APIError }
>(
  'portfolio/fetchPerformance',
  async ({ range, benchmark }, { rejectWithValue }) => {
    try {
      return await apiClient<PerformanceData>('/portfolio/performance', {
        params: { range, benchmark },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    clearPortfolioError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchPortfolioSummary
    builder
      .addCase(fetchPortfolioSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortfolioSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchPortfolioSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch portfolio summary';
      });

    // fetchAssetAllocation
    builder
      .addCase(fetchAssetAllocation.fulfilled, (state, action) => {
        state.allocation = action.payload;
      });

    // fetchPortfolioPerformance
    builder
      .addCase(fetchPortfolioPerformance.fulfilled, (state, action) => {
        state.performance = action.payload;
      });
  },
});

export const { clearPortfolioError } = portfolioSlice.actions;
export default portfolioSlice.reducer;
