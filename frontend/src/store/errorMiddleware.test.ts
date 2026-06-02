import { describe, it, expect } from 'vitest';
import { configureStore, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { errorMiddleware } from './errorMiddleware';
import uiReducer from './slices/uiSlice';
import type { APIError } from './api';

describe('errorMiddleware', () => {
  function createTestStore() {
    const testSlice = createSlice({
      name: 'test',
      initialState: { data: null as string | null },
      reducers: {},
    });

    return configureStore({
      reducer: {
        test: testSlice.reducer,
        ui: uiReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: false }).concat(errorMiddleware),
    });
  }

  it('dispatches a toast on rejected async thunk with rejectWithValue', async () => {
    const store = createTestStore();

    const failingThunk = createAsyncThunk<string, void, { rejectValue: APIError }>(
      'test/fail',
      async (_, { rejectWithValue }) => {
        return rejectWithValue({
          code: 'NETWORK_ERROR',
          message: 'Connection failed',
          retryable: true,
        });
      }
    );

    await store.dispatch(failingThunk());

    const toasts = store.getState().ui.toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].message).toContain('Network connection failed');
    expect(toasts[0].retryable).toBe(true);
  });

  it('dispatches a toast with user-friendly message for known error codes', async () => {
    const store = createTestStore();

    const failingThunk = createAsyncThunk<string, void, { rejectValue: APIError }>(
      'test/fail',
      async (_, { rejectWithValue }) => {
        return rejectWithValue({
          code: 'INVALID_TICKER',
          message: 'Bad ticker',
          retryable: false,
        });
      }
    );

    await store.dispatch(failingThunk());

    const toasts = store.getState().ui.toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toContain('Invalid ticker symbol');
    expect(toasts[0].retryable).toBe(false);
  });

  it('does not dispatch toast for suppressed error codes', async () => {
    const store = createTestStore();

    const failingThunk = createAsyncThunk<string, void, { rejectValue: APIError }>(
      'test/fail',
      async (_, { rejectWithValue }) => {
        return rejectWithValue({
          code: 'PARSE_INCOMPLETE',
          message: 'Partial parse',
          retryable: false,
        });
      }
    );

    await store.dispatch(failingThunk());

    const toasts = store.getState().ui.toasts;
    expect(toasts).toHaveLength(0);
  });

  it('handles generic error messages when error code is unknown', async () => {
    const store = createTestStore();

    const failingThunk = createAsyncThunk('test/fail', async () => {
      throw new Error('Something went wrong');
    });

    await store.dispatch(failingThunk());

    const toasts = store.getState().ui.toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Something went wrong');
  });

  it('does not dispatch toast for successful actions', async () => {
    const store = createTestStore();

    const successfulThunk = createAsyncThunk('test/success', async () => {
      return 'data';
    });

    await store.dispatch(successfulThunk());

    const toasts = store.getState().ui.toasts;
    expect(toasts).toHaveLength(0);
  });
});
