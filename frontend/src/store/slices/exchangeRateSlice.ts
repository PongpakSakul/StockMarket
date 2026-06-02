import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../api';
import type { APIError } from '../api';

// ============================================================
// Types
// ============================================================

export interface ExchangeRate {
  currencyPair: string;
  rate: number;
  fetchedAt: string;
  isStale: boolean;
}

export interface ExchangeRateState {
  currentRate: ExchangeRate | null;
  loading: boolean;
  error: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: ExchangeRateState = {
  currentRate: null,
  loading: false,
  error: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchExchangeRate = createAsyncThunk<
  ExchangeRate,
  void,
  { rejectValue: APIError }
>(
  'exchangeRate/fetchRate',
  async (_, { rejectWithValue }) => {
    try {
      return await apiClient<ExchangeRate>('/exchange-rate/usd-thb', {
        maxRetries: 2,
        initialDelay: 1000,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const exchangeRateSlice = createSlice({
  name: 'exchangeRate',
  initialState,
  reducers: {
    clearExchangeRateError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExchangeRate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExchangeRate.fulfilled, (state, action) => {
        state.loading = false;
        state.currentRate = action.payload;
      })
      .addCase(fetchExchangeRate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch exchange rate';
        // Mark existing cached rate as stale when API fails
        if (state.currentRate) {
          state.currentRate = { ...state.currentRate, isStale: true };
        }
      });
  },
});

export const { clearExchangeRateError } = exchangeRateSlice.actions;
export default exchangeRateSlice.reducer;
