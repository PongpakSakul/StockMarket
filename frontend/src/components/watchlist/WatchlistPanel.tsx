'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  fetchWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  setWatchlistSort,
  clearWatchlistError,
  type WatchlistSortBy,
} from '../../store/slices/watchlistSlice';
import WatchlistItemComponent from './WatchlistItem';

export interface WatchlistPanelProps {
  onNavigateToChart?: (ticker: string) => void;
}

export default function WatchlistPanel({ onNavigateToChart }: WatchlistPanelProps) {
  const dispatch = useAppDispatch();
  const { items, sortBy, loading, error } = useAppSelector((state) => state.watchlist);

  const [tickerInput, setTickerInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchWatchlist());
  }, [dispatch]);

  // Sort items based on current sortBy
  const sortedItems = useMemo(() => {
    const sorted = [...(items || [])];
    switch (sortBy) {
      case 'ticker':
        sorted.sort((a, b) => a.tickerSymbol.localeCompare(b.tickerSymbol));
        break;
      case 'price':
        sorted.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case 'change':
        sorted.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
        break;
    }
    return sorted;
  }, [items, sortBy]);

  const handleAddTicker = useCallback(async () => {
    const ticker = tickerInput.trim().toUpperCase();

    // Validate input
    if (!ticker) {
      setValidationError('Please enter a ticker symbol.');
      return;
    }

    if (!/^[A-Z]{1,5}$/.test(ticker)) {
      setValidationError('Ticker must be 1-5 uppercase letters.');
      return;
    }

    // Check for duplicates
    const isDuplicate = (items || []).some(
      (item) => item.tickerSymbol.toUpperCase() === ticker
    );
    if (isDuplicate) {
      setValidationError(`${ticker} is already in your watchlist.`);
      return;
    }

    setValidationError(null);
    try {
      await dispatch(addToWatchlist(ticker)).unwrap();
      setTickerInput('');
    } catch {
      // Error is handled by Redux slice
    }
  }, [tickerInput, items, dispatch]);

  const handleRemove = useCallback(
    (ticker: string) => {
      dispatch(removeFromWatchlist(ticker));
    },
    [dispatch]
  );

  const handleSelect = useCallback(
    (ticker: string) => {
      if (onNavigateToChart) {
        onNavigateToChart(ticker);
      }
    },
    [onNavigateToChart]
  );

  const handleSortChange = useCallback(
    (sort: WatchlistSortBy) => {
      dispatch(setWatchlistSort(sort));
    },
    [dispatch]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleAddTicker();
      }
    },
    [handleAddTicker]
  );

  const handleDismissError = useCallback(() => {
    dispatch(clearWatchlistError());
  }, [dispatch]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" data-testid="watchlist-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Watchlist</h2>
      </div>

      {/* Add Ticker Form */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={tickerInput}
            onChange={(e) => {
              setTickerInput(e.target.value);
              setValidationError(null);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter ticker (e.g. AAPL)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Ticker symbol input"
            data-testid="ticker-input"
          />
          <button
            type="button"
            onClick={handleAddTicker}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="add-ticker-btn"
          >
            Add
          </button>
        </div>
        {validationError && (
          <p className="mt-1 text-xs text-red-600" role="alert" data-testid="validation-error">
            {validationError}
          </p>
        )}
      </div>

      {/* Sort Controls */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Sort:</span>
        <div className="flex gap-1" role="group" aria-label="Sort options">
          {([
            { value: 'ticker', label: 'Ticker' },
            { value: 'price', label: 'Price' },
            { value: 'change', label: '% Change' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSortChange(option.value)}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                sortBy === option.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-pressed={sortBy === option.value}
              data-testid={`sort-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="mx-4 mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-center justify-between"
          role="alert"
          data-testid="api-error"
        >
          <span className="text-sm text-red-700">{error}</span>
          <button
            type="button"
            onClick={handleDismissError}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && items.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500 text-sm" data-testid="loading-state">
          Loading watchlist...
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500 text-sm" data-testid="empty-state">
          Your watchlist is empty. Add a ticker above to get started.
        </div>
      )}

      {/* Watchlist Items */}
      {sortedItems.length > 0 && (
        <div data-testid="watchlist-items" role="list" aria-label="Watchlist items">
          {sortedItems.map((item) => (
            <WatchlistItemComponent
              key={item.tickerSymbol}
              item={item}
              onRemove={handleRemove}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
