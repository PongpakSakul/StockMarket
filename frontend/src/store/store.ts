import { configureStore } from '@reduxjs/toolkit';
import chartReducer from './slices/chartSlice';
import transactionsReducer from './slices/transactionsSlice';
import portfolioReducer from './slices/portfolioSlice';
import dividendsReducer from './slices/dividendsSlice';
import watchlistReducer from './slices/watchlistSlice';
import exchangeRateReducer from './slices/exchangeRateSlice';
import uiReducer from './slices/uiSlice';
import { errorMiddleware } from './errorMiddleware';
import { cacheInvalidationMiddleware } from './cacheInvalidationMiddleware';

export const makeStore = () => {
  return configureStore({
    reducer: {
      chart: chartReducer,
      transactions: transactionsReducer,
      portfolio: portfolioReducer,
      dividends: dividendsReducer,
      watchlist: watchlistReducer,
      exchangeRate: exchangeRateReducer,
      ui: uiReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .prepend(cacheInvalidationMiddleware.middleware)
        .concat(errorMiddleware),
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
