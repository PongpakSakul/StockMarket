'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { searchTickers, clearSearchResults, setSelectedTicker } from '@/store/slices/chartSlice';
import type { TickerSearchResult } from '@/store/slices/chartSlice';

export interface TickerSearchProps {
  onSelect: (ticker: string) => void;
}

export default function TickerSearch({ onSelect }: TickerSearchProps) {
  const dispatch = useAppDispatch();
  const searchResults = useAppSelector((state) => state.chart.searchResults) ?? [];

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (searchQuery.trim().length === 0) {
        dispatch(clearSearchResults());
        setIsOpen(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        await dispatch(searchTickers(searchQuery.trim()));
        setIsSearching(false);
        setIsOpen(true);
      }, 300);
    },
    [dispatch]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleSelect = (result: TickerSearchResult) => {
    setQuery(result.ticker);
    setIsOpen(false);
    dispatch(clearSearchResults());
    dispatch(setSelectedTicker(result.ticker));
    onSelect(result.ticker);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search ticker symbol..."
          aria-label="Search ticker symbol"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div
              className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"
              data-testid="search-loading"
            />
          </div>
        )}
      </div>

      {isOpen && (
        <div
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          data-testid="search-dropdown"
          role="listbox"
        >
          {searchResults.length === 0 && !isSearching ? (
            <div className="px-4 py-3 text-sm text-gray-500" data-testid="no-results">
              No results found
            </div>
          ) : (
            searchResults.map((result) => (
              <button
                key={result.ticker}
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                role="option"
                aria-selected={false}
              >
                <span className="font-semibold text-gray-900">{result.ticker}</span>
                <span className="ml-2 text-sm text-gray-500">{result.name}</span>
                <span className="ml-2 text-xs text-gray-400 uppercase">{result.exchange}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
