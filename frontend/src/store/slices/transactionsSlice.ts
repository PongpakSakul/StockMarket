import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient, apiUpload } from '../api';
import type { APIError } from '../api';

// ============================================================
// Types
// ============================================================

export type TransactionSource = 'manual' | 'ocr' | 'dime_import';

export interface Transaction {
  id: string;
  userId: string;
  tickerSymbol: string;
  transactionDate: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  source: TransactionSource;
  slipImageUrl?: string;
  ocrRawText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionDTO {
  tickerSymbol: string;
  transactionDate: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  source?: TransactionSource;
}

export interface UpdateTransactionDTO {
  tickerSymbol?: string;
  transactionDate?: string;
  pricePerShare?: number;
  shares?: number;
  totalAmount?: number;
}

export interface TransactionFilters {
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'date' | 'ticker' | 'amount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StructuredTransaction {
  ticker: string;
  date: string;
  price_per_share: number;
  shares: number;
  total_amount: number;
}

export interface SlipUploadResult {
  transaction: StructuredTransaction;
  missingFields: string[];
  confidence: Record<string, number>;
}

export interface BatchUploadResult {
  results: Array<{
    success: boolean;
    transaction?: StructuredTransaction;
    missingFields?: string[];
    error?: string;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export interface TransactionsState {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: TransactionFilters;
  slipUploadResult: SlipUploadResult | null;
  batchUploadResult: BatchUploadResult | null;
  loading: boolean;
  uploading: boolean;
  error: string | null;
  errorCode: string | null;
}

// ============================================================
// Initial State
// ============================================================

const initialState: TransactionsState = {
  transactions: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  filters: {},
  slipUploadResult: null,
  batchUploadResult: null,
  loading: false,
  uploading: false,
  error: null,
  errorCode: null,
};

// ============================================================
// Async Thunks
// ============================================================

export const fetchTransactions = createAsyncThunk<
  PaginatedTransactions,
  TransactionFilters,
  { rejectValue: APIError }
>(
  'transactions/fetchTransactions',
  async (filters, { rejectWithValue }) => {
    try {
      return await apiClient<PaginatedTransactions>('/transactions', {
        params: {
          ticker: filters.tickerSymbol,
          from: filters.fromDate,
          to: filters.toDate,
          sort: filters.sortBy,
          order: filters.sortOrder,
          page: filters.page,
          pageSize: filters.pageSize,
        },
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const createTransaction = createAsyncThunk<
  Transaction,
  CreateTransactionDTO,
  { rejectValue: APIError }
>(
  'transactions/createTransaction',
  async (data, { rejectWithValue }) => {
    try {
      return await apiClient<Transaction>('/transactions', {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const updateTransaction = createAsyncThunk<
  Transaction,
  { id: string; data: UpdateTransactionDTO },
  { rejectValue: APIError }
>(
  'transactions/updateTransaction',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await apiClient<Transaction>(`/transactions/${id}`, {
        method: 'PUT',
        body: data,
      });
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const deleteTransaction = createAsyncThunk<
  string,
  string,
  { rejectValue: APIError }
>(
  'transactions/deleteTransaction',
  async (id, { rejectWithValue }) => {
    try {
      await apiClient<void>(`/transactions/${id}`, { method: 'DELETE' });
      return id;
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const uploadSlip = createAsyncThunk<
  SlipUploadResult,
  File,
  { rejectValue: APIError }
>(
  'transactions/uploadSlip',
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('slip', file);
      return await apiUpload<SlipUploadResult>('/slips/upload', formData, 2, 2000);
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const uploadSlipBatch = createAsyncThunk<
  BatchUploadResult,
  File[],
  { rejectValue: APIError }
>(
  'transactions/uploadSlipBatch',
  async (files, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('slips', file));
      return await apiUpload<BatchUploadResult>('/slips/upload-batch', formData);
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

export const validateTicker = createAsyncThunk<
  { valid: boolean; ticker?: string },
  string,
  { rejectValue: APIError }
>(
  'transactions/validateTicker',
  async (ticker, { rejectWithValue }) => {
    try {
      return await apiClient<{ valid: boolean; ticker?: string }>(`/tickers/validate/${ticker}`);
    } catch (error) {
      return rejectWithValue(error as APIError);
    }
  }
);

// ============================================================
// Slice
// ============================================================

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<TransactionFilters>) {
      state.filters = action.payload;
    },
    clearSlipUploadResult(state) {
      state.slipUploadResult = null;
    },
    clearBatchUploadResult(state) {
      state.batchUploadResult = null;
    },
    clearTransactionsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // fetchTransactions
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to fetch transactions';
        state.errorCode = action.payload?.code || null;
      });

    // createTransaction
    builder
      .addCase(createTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
        state.total += 1;
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to create transaction';
        state.errorCode = action.payload?.code || null;
      });

    // updateTransaction
    builder
      .addCase(updateTransaction.fulfilled, (state, action) => {
        const index = state.transactions.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.transactions[index] = action.payload;
        }
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.error = action.payload?.message || action.error.message || 'Failed to update transaction';
        state.errorCode = action.payload?.code || null;
      });

    // deleteTransaction
    builder
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.transactions = state.transactions.filter((t) => t.id !== action.payload);
        state.total -= 1;
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.error = action.payload?.message || action.error.message || 'Failed to delete transaction';
        state.errorCode = action.payload?.code || null;
      });

    // uploadSlip
    builder
      .addCase(uploadSlip.pending, (state) => {
        state.uploading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(uploadSlip.fulfilled, (state, action) => {
        state.uploading = false;
        state.slipUploadResult = action.payload;
      })
      .addCase(uploadSlip.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to upload slip';
        state.errorCode = action.payload?.code || null;
      });

    // uploadSlipBatch
    builder
      .addCase(uploadSlipBatch.pending, (state) => {
        state.uploading = true;
        state.error = null;
        state.errorCode = null;
      })
      .addCase(uploadSlipBatch.fulfilled, (state, action) => {
        state.uploading = false;
        state.batchUploadResult = action.payload;
      })
      .addCase(uploadSlipBatch.rejected, (state, action) => {
        state.uploading = false;
        state.error = action.payload?.message || action.error.message || 'Failed to upload batch';
        state.errorCode = action.payload?.code || null;
      });
  },
});

export const {
  setFilters,
  clearSlipUploadResult,
  clearBatchUploadResult,
  clearTransactionsError,
} = transactionsSlice.actions;
export default transactionsSlice.reducer;
