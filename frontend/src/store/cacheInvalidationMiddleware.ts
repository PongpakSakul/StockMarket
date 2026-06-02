/**
 * Cache Invalidation & Data Refresh Middleware
 *
 * Listens for successful transaction and dividend CRUD operations,
 * then automatically dispatches portfolio/chart/dashboard refresh actions.
 *
 * Requirements: 3.5, 5.6, 6.4, 7.2
 */
import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './store';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './slices/transactionsSlice';
import {
  createDividend,
  updateDividend,
  deleteDividend,
} from './slices/dividendsSlice';
import {
  fetchPortfolioSummary,
  fetchAssetAllocation,
} from './slices/portfolioSlice';
import { fetchBuyPoints } from './slices/chartSlice';

// ============================================================
// Create the listener middleware
// ============================================================

export const cacheInvalidationMiddleware = createListenerMiddleware();

const startListening = cacheInvalidationMiddleware.startListening.withTypes<
  RootState,
  AppDispatch
>();

// ============================================================
// After transaction CRUD → refresh portfolio + chart buy points
// Requirements: 3.5, 5.6, 6.4, 7.2
// ============================================================

startListening({
  matcher: isAnyOf(
    createTransaction.fulfilled,
    updateTransaction.fulfilled,
    deleteTransaction.fulfilled,
  ),
  effect: async (_action, listenerApi) => {
    const dispatch = listenerApi.dispatch;
    const state = listenerApi.getState();

    // Refresh portfolio summary and allocation
    dispatch(fetchPortfolioSummary());
    dispatch(fetchAssetAllocation());

    // Refresh chart buy points if a ticker is currently selected
    const selectedTicker = state.chart.selectedTicker;
    if (selectedTicker) {
      dispatch(fetchBuyPoints(selectedTicker));
    }
  },
});

// ============================================================
// After dividend CRUD → refresh portfolio/dashboard
// Requirements: 5.6, 7.2
// ============================================================

startListening({
  matcher: isAnyOf(
    createDividend.fulfilled,
    updateDividend.fulfilled,
    deleteDividend.fulfilled,
  ),
  effect: async (_action, listenerApi) => {
    const dispatch = listenerApi.dispatch;

    // Refresh portfolio summary (includes dividend yield, total return)
    dispatch(fetchPortfolioSummary());
    dispatch(fetchAssetAllocation());
  },
});
