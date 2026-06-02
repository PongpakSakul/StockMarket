import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api';
import type { APIError } from '../api';
import type { TimeRange } from './chartSlice';

// ============================================================
// Types
// ============================================================

export interface Dividend {
  id: string;
  userId: string;
  tickerSymbol: string;
  dividendDate: string;
  amountPerShare: number;
  totalAmount: number;
  sharesHeld: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDividendDTO {
  tickerSymbol: string;
  dividendDate: string;
  amountPerShare: number;
  totalAmount: number;
  sharesHeld: number;
}

export interface UpdateDividendDTO {
  tickerSymbol?: string;
  dividendDate?: string;
  amountPerShare?: number;
  totalAmount?: number;
  sharesHeld?: number;
}

export interface DividendFilters {
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedDividends {
  data: Dividend[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DividendSummary {
  totalDividends: number;
  dividendsByTicker: Record<string, number>;
  timeRange: TimeRange;
}

export interface DividendsState {
  dividends: Dividend[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: DividendFilters;
  summary: DividendSummary | null;
  loading: boolean;
  error: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: DividendsState = {
  dividends: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  filters: {},
  summary: null,
  loading: false,
  error: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchDividends = createAsyncThunk<
  PaginatedDividends,
  DividendFilters,
  { rejectValue: APIError }
>(
  'dividends/fetchDividends',
  async (filters, { rejectWithValue }) => {
    try {
      return await apiClient<PaginatedDividends>('/dividends', {
        params: {
          ticker: filters.tickerSymbol,
          from: filters.fromDate,
          to: filters.toDate,
          page: filters.page,
          pageSize: filters.pageSize,
        },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const createDividend = createAsyncThunk<
  Dividend,
  CreateDividendDTO,
  { rejectValue: APIError }
>(
  'dividends/createDividend',
  async (data, { rejectWithValue }) => {
    try {
      return await apiClient<Dividend>('/dividends', {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const updateDividend = createAsyncThunk<
  Dividend,
  { id: string; data: UpdateDividendDTO },
  { rejectValue: APIError }
>(
  'dividends/updateDividend',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await apiClient<Dividend>(`/dividends/${id}`, {
        method: 'PUT',
        body: data,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const deleteDividend = createAsyncThunk<
  string,
  string,
  { rejectValue: APIError }
>(
  'dividends/deleteDividend',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient<void>(`/dividends/${id}`, { method: 'DELETE' });
      return id;
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const fetchDividendSummary = createAsyncThunk<
  DividendSummary,
  TimeRange,
  { rejectValue: APIError }
>(
  'dividends/fetchSummary',
  async (range, { rejectWithValue }) => {
    try {
      return await apiClient<DividendSummary>('/dividends/summary', {
        params: { range },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const dividendsSlice = createSlice({
  name: 'dividends',
  initialState,
  reducers: {
    setDividendFilters(state, action: PayloadAction<DividendFilters>) {
      state.filters = action.payload;
    },
    clearDividendsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchDividends
    builder
      .addCase(fetchDividends.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDividends.fulfilled, (state, action) => {
        state.loading = false;
        state.dividends = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchDividends.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch dividends';
      });

    // createDividend
    builder
      .addCase(createDividend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDividend.fulfilled, (state, action) => {
        state.loading = false;
        state.dividends.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createDividend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to create dividend';
      });

    // updateDividend
    builder
      .addCase(updateDividend.fulfilled, (state, action) => {
        const index = state.dividends.findIndex((d) => d.id === action.payload.id);
        if (index !== -1) {
          state.dividends[index] = action.payload;
        }
      });

    // deleteDividend
    builder
      .addCase(deleteDividend.fulfilled, (state, action) => {
        state.dividends = state.dividends.filter((d) => d.id !== action.payload);
        state.total -= 1;
      });

    // fetchDividendSummary
    builder
      .addCase(fetchDividendSummary.fulfilled, (state, action) => {
        state.summary = action.payload;
      });
  },
});

export const { setDividendFilters, clearDividendsError } = dividendsSlice.actions;
export default dividendsSlice.reducer;
