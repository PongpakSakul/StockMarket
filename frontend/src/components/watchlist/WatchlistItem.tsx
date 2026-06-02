'use client';

import type { WatchlistItem as WatchlistItemType } from '../../store/slices/watchlistSlice';
import Sparkline from './Sparkline';

export interface WatchlistItemProps {
  item: WatchlistItemType;
  onRemove: (ticker: string) => void;
  onSelect: (ticker: string) => void;
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function WatchlistItem({ item, onRemove, onSelect }: WatchlistItemProps) {
  const changeColor = item.priceChangeAmount >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer group"
      data-testid={`watchlist-item-${item.tickerSymbol}`}
      onClick={() => onSelect(item.tickerSymbol)}
      role="button"
      tabIndex={0}
      aria-label={`View chart for ${item.tickerSymbol}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.tickerSymbol);
        }
      }}
    >
      {/* Ticker info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900" data-testid="item-ticker">
          {item.tickerSymbol}
        </p>
        <p className="text-xs text-gray-500 truncate" data-testid="item-name">
          {item.tickerName}
        </p>
      </div>

      {/* Sparkline */}
      <div className="flex-shrink-0">
        <Sparkline data={item.sparklineData} />
      </div>

      {/* Price and change */}
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-medium text-gray-900" data-testid="item-price">
          {formatPrice(item.currentPrice)}
        </p>
        <p className={`text-xs ${changeColor}`} data-testid="item-change">
          {formatChange(item.priceChangeAmount)} ({formatPercent(item.priceChangePercent)})
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.tickerSymbol);
        }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600"
        aria-label={`Remove ${item.tickerSymbol} from watchlist`}
        data-testid={`remove-${item.tickerSymbol}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
