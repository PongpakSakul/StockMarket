import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import portfolioReducer from '@/store/slices/portfolioSlice';
import exchangeRateReducer from '@/store/slices/exchangeRateSlice';
import uiReducer from '@/store/slices/uiSlice';
import transactionsReducer from '@/store/slices/transactionsSlice';
import DashboardPage from './page';

// Mock fetch to prevent API calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
});

function createTestStore() {
  return configureStore({
    reducer: {
      portfolio: portfolioReducer,
      exchangeRate: exchangeRateReducer,
      ui: uiReducer,
      transactions: transactionsReducer,
    },
  });
}

function renderPage() {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <DashboardPage />
    </Provider>
  );
}

describe('Dashboard Page', () => {
  it('should render the page title', () => {
    renderPage();
    expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument();
  });

  it('should show loading skeleton initially', () => {
    renderPage();
    expect(screen.getByLabelText('Loading data')).toBeInTheDocument();
  });
});
