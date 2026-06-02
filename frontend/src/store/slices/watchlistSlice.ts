import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api';
import type { APIError } from '../api';

// ============================================================
// Types
// ============================================================

export interface WatchlistItem {
  tickerSymbol: string;
  tickerName: string;
  currentPrice: number;
  priceChangeAmount: number;
  priceChangePercent: number;
  sparklineData: number[];
}

export type WatchlistSortBy = 'ticker' | 'price' | 'change';

export interface WatchlistState {
  items: WatchlistItem[];
  sortBy: WatchlistSortBy;
  loading: boolean;
  error: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: WatchlistState = {
  items: [],
  sortBy: 'ticker',
  loading: false,
  error: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchWatchlist = createAsyncThunk<
  WatchlistItem[],
  void,
  { rejectValue: APIError }
>(
  'watchlist/fetchWatchlist',
  async (_, { rejectWithValue }) => {
    try {
      return await apiClient<WatchlistItem[]>('/watchlist');
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const addToWatchlist = createAsyncThunk<
  WatchlistItem,
  string,
  { rejectValue: APIError }
>(
  'watchlist/addToWatchlist',
  async (ticker, { rejectWithValue }) => {
    try {
      return await apiClient<WatchlistItem>('/watchlist', {
        method: 'POST',
        body: { ticker },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const removeFromWatchlist = createAsyncThunk<
  string,
  string,
  { rejectValue: APIError }
>(
  'watchlist/removeFromWatchlist',
  async (ticker, { rejectWithValue }) => {
    try {
      await apiClient<void>(`/watchlist/${ticker}`, { method: 'DELETE' });
      return ticker;
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    setWatchlistSort(state, action: PayloadAction<WatchlistSortBy>) {
      state.sortBy = action.payload;
    },
    clearWatchlistError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchWatchlist
    builder
      .addCase(fetchWatchlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch watchlist';
      });

    // addToWatchlist
    builder
      .addCase(addToWatchlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToWatchlist.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(addToWatchlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to add to watchlist';
      });

    // removeFromWatchlist
    builder
      .addCase(removeFromWatchlist.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.tickerSymbol !== action.payload);
      })
      .addCase(removeFromWatchlist.rejected, (state, action) => {
        state.error = action.payload?.message || action.error.message || 'Failed to remove from watchlist';
      });
  },
});

export const { setWatchlistSort, clearWatchlistError } = watchlistSlice.actions;
export default watchlistSlice.reducer;
