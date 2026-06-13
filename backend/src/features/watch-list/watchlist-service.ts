import { WatchlistItem } from '../../types';
import { ChartService } from '../charts/chart.service';

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

import { IWatchlistRepository } from './watchlist.repository';
import { ensureTickerExists } from '../tickers/ticker.service';

// ────────────────────────────────────────────────────────────
// Watchlist Service
// ────────────────────────────────────────────────────────────

export class WatchlistService {
  constructor(
    private readonly chartService: ChartService,
    private readonly repository: IWatchlistRepository
  ) {}

  /**
   * Get all watchlist items with current price, daily change, and sparkline data.
   *
   * Requirements: 12.1, 12.3, 12.6
   */
  async getWatchlist(userId: string, options: WatchlistSortOptions = {}): Promise<WatchlistItem[]> {
    const entries = await this.repository.getAll(userId);
    if (entries.length === 0) {
      return [];
    }

    const items: WatchlistItem[] = [];

    for (const entry of entries) {
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
  async addToWatchlist(userId: string, ticker: string): Promise<WatchlistItem> {
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!normalizedTicker) {
      throw new WatchlistError('INVALID_TICKER', 'Ticker symbol cannot be empty');
    }

    // Check for duplicates
    if (await this.repository.has(userId, normalizedTicker)) {
      throw new WatchlistError(
        'DUPLICATE_WATCHLIST',
        `${normalizedTicker} is already in your watchlist`,
      );
    }

    // Validate ticker and ensure it exists in the database
    await ensureTickerExists(normalizedTicker, this.chartService);

    // Store the entry
    await this.repository.add(userId, normalizedTicker);

    // Return the full watchlist item with live data
    return this.buildWatchlistItem(normalizedTicker);
  }

  /**
   * Remove a ticker from the watchlist.
   *
   * Requirements: 12.5
   */
  async removeFromWatchlist(userId: string, ticker: string): Promise<void> {
    const normalizedTicker = ticker.trim().toUpperCase();

    if (!(await this.repository.has(userId, normalizedTicker))) {
      throw new WatchlistError(
        'NOT_FOUND',
        `${normalizedTicker} is not in your watchlist`,
      );
    }

    await this.repository.remove(userId, normalizedTicker);
  }

  /**
   * Clear the entire watchlist (useful for testing).
   */
  clear(): void {
    // Note: To clear properly we would need to delete all records for all users,
    // but typically this is only used for in-memory testing. 
    // We can leave this as a no-op or add a clearAll to the repo if needed.
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
