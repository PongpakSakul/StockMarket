import { WatchlistItem } from '../types';
import { ChartService } from './chart-service';

// ────────────────────────────────────────────────────────────
// Error Types
// ────────────────────────────────────────────────────────────

export class WatchlistError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WatchlistError';
  }
}

// ────────────────────────────────────────────────────────────
// Sort Options
// ────────────────────────────────────────────────────────────

export type WatchlistSortField = 'ticker' | 'price' | 'percentChange';
export type WatchlistSortOrder = 'asc' | 'desc';

export interface WatchlistSortOptions {
  sortBy?: WatchlistSortField;
  sortOrder?: WatchlistSortOrder;
}

// ────────────────────────────────────────────────────────────
// In-memory store for watchlist tickers
// ────────────────────────────────────────────────────────────

/** Internal record stored in memory (just the ticker, prices are fetched live) */
interface WatchlistEntry {
  tickerSymbol: string;
  addedAt: string;
}

// ────────────────────────────────────────────────────────────
// Watchlist Service
// ────────────────────────────────────────────────────────────

export class WatchlistService {
  private store: Map<string, WatchlistEntry> = new Map();

  constructor(private readonly chartService: ChartService) {}

  /**
   * Get all watchlist items with current price, daily change, and sparkline data.
   *
   * Requirements: 12.1, 12.3, 12.6
   */
  async getWatchlist(options: WatchlistSortOptions = {}): Promise<WatchlistItem[]> {
    if (this.store.size === 0) {
      return [];
    }

    const items: WatchlistItem[] = [];

    for (const entry of this.store.values()) {
      const item = await this.buildWatchlistItem(entry.tickerSymbol);
      items.push(item);
    }

    return this.sortItems(items, options);
  }

  /**
   * Add a ticker to the watchlist.
   * Validates the ticker via ChartService (Financial API) and rejects duplicates.
   *
   * Requirements: 12.1, 12.2, 12.7
   */
  async addToWatchlist(ticker: string): Promise<WatchlistItem> {
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!normalizedTicker) {
      throw new WatchlistError('INVALID_TICKER', 'Ticker symbol cannot be empty');
    }

    // Check for duplicates
    if (this.store.has(normalizedTicker)) {
      throw new WatchlistError(
        'DUPLICATE_WATCHLIST',
        `${normalizedTicker} is already in your watchlist`,
      );
    }

    // Validate ticker via Financial API (ChartService.getStockInfo)
    try {
      await this.chartService.getStockInfo(normalizedTicker);
    } catch {
      throw new WatchlistError(
        'INVALID_TICKER',
        `Ticker symbol "${normalizedTicker}" is not a valid stock or ETF`,
      );
    }

    // Store the entry
    const entry: WatchlistEntry = {
      tickerSymbol: normalizedTicker,
      addedAt: new Date().toISOString(),
    };
    this.store.set(normalizedTicker, entry);

    // Return the full watchlist item with live data
    return this.buildWatchlistItem(normalizedTicker);
  }

  /**
   * Remove a ticker from the watchlist.
   *
   * Requirements: 12.5
   */
  async removeFromWatchlist(ticker: string): Promise<void> {
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!this.store.has(normalizedTicker)) {
      throw new WatchlistError(
        'NOT_FOUND',
        `${normalizedTicker} is not in your watchlist`,
      );
    }

    this.store.delete(normalizedTicker);
  }

  /**
   * Clear the entire watchlist (useful for testing).
   */
  clear(): void {
    this.store.clear();
  }

  // ──────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Build a full WatchlistItem by fetching live data from ChartService.
   */
  private async buildWatchlistItem(ticker: string): Promise<WatchlistItem> {
    const stockInfo = await this.chartService.getStockInfo(ticker);

    // Calculate daily change from currentPrice and previousClose
    const priceChangeAmount = stockInfo.currentPrice - stockInfo.previousClose;
    const priceChangePercent =
      stockInfo.previousClose !== 0
        ? (priceChangeAmount / stockInfo.previousClose) * 100
        : 0;

    // Get sparkline data (last 7 days of closing prices)
    const sparklineData = await this.getSparklineData(ticker);

    return {
      tickerSymbol: stockInfo.ticker,
      tickerName: stockInfo.name,
      currentPrice: stockInfo.currentPrice,
      priceChangeAmount: Math.round(priceChangeAmount * 100) / 100,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100,
      sparklineData,
    };
  }

  /**
   * Get sparkline data (recent closing prices) for a ticker.
   * Uses 1W price data and extracts close prices.
   */
  private async getSparklineData(ticker: string): Promise<number[]> {
    try {
      const prices = await this.chartService.getStockPrices(ticker, '1W');
      return prices.map((p) => p.close);
    } catch {
      // If we can't get sparkline data, return empty array
      return [];
    }
  }

  /**
   * Sort watchlist items by the specified field and order.
   */
  private sortItems(items: WatchlistItem[], options: WatchlistSortOptions): WatchlistItem[] {
    const { sortBy = 'ticker', sortOrder = 'asc' } = options;
    const direction = sortOrder === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'ticker':
          cmp = a.tickerSymbol.localeCompare(b.tickerSymbol);
          break;
        case 'price':
          cmp = a.currentPrice - b.currentPrice;
          break;
        case 'percentChange':
          cmp = a.priceChangePercent - b.priceChangePercent;
          break;
      }
      return cmp * direction;
    });
  }
}
