import { OHLCData, StockInfo, TickerSearchResult, TimeRange } from '../../types';
import { InMemoryCache } from '../../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const CACHE_PREFIX_PRICES = 'chart:prices:';
const CACHE_PREFIX_INFO = 'chart:info:';
const CACHE_PREFIX_SEARCH = 'chart:search:';

/** 5 minutes for latest/short-range price data */
const LATEST_PRICES_TTL_MS = 5 * 60 * 1000;
/** 24 hours for historical price data */
const HISTORICAL_PRICES_TTL_MS = 24 * 60 * 60 * 1000;
/** 1 hour for search results */
const SEARCH_TTL_MS = 60 * 60 * 1000;
/** 24 hours for stock info */
const INFO_TTL_MS = 24 * 60 * 60 * 1000;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ────────────────────────────────────────────────────────────
// HTTP Client Interface (for dependency injection / testing)
// ────────────────────────────────────────────────────────────

export interface IFinancialApiClient {
  fetchPrices(ticker: string, range: TimeRange): Promise<OHLCData[]>;
  fetchStockInfo(ticker: string): Promise<StockInfo>;
  searchTickers(query: string): Promise<TickerSearchResult[]>;
}

// ────────────────────────────────────────────────────────────
// Chart Service
// ────────────────────────────────────────────────────────────

export class ChartService {
  constructor(
    private readonly apiClient: IFinancialApiClient,
    private readonly cache: InMemoryCache,
  ) {}

  /**
   * Fetch OHLC price data for a ticker within a time range.
   *
   * Strategy:
   * 1. Check in-memory cache
   * 2. If cache miss, fetch from Financial API with retry (3 retries, exponential backoff starting at 1s)
   * 3. Cache with appropriate TTL: 5-min for latest (1W, 1M), 24-hour for historical (3M+)
   *
   * Requirements: 1.1, 1.2, 1.3, 1.4, 7.2
   */
  async getStockPrices(ticker: string, range: TimeRange): Promise<OHLCData[]> {
    const cacheKey = `${CACHE_PREFIX_PRICES}${ticker}:${range}`;

    // 1. Check cache
    const cached = this.cache.get<OHLCData[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch from API with retries
    const data = await this.fetchWithRetry(() => this.apiClient.fetchPrices(ticker, range));

    // 3. Cache with appropriate TTL
    const ttl = this.getTtlForRange(range);
    this.cache.set(cacheKey, data, ttl);

    return data;
  }

  /**
   * Fetch stock/ETF metadata for a ticker.
   *
   * Strategy:
   * 1. Check in-memory cache (24-hour TTL)
   * 2. If cache miss, fetch from Financial API with retry
   *
   * Requirements: 1.1
   */
  async getStockInfo(ticker: string): Promise<StockInfo> {
    const cacheKey = `${CACHE_PREFIX_INFO}${ticker}`;

    // 1. Check cache
    const cached = this.cache.get<StockInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch from API with retries
    const info = await this.fetchWithRetry(() => this.apiClient.fetchStockInfo(ticker));

    // 3. Cache
    this.cache.set(cacheKey, info, INFO_TTL_MS);

    return info;
  }

  /**
   * Search for tickers matching a query string (autocomplete).
   *
   * Strategy:
   * 1. Check in-memory cache (1-hour TTL)
   * 2. If cache miss, fetch from Financial API with retry
   *
   * Requirements: 1.1, 1.6
   */
  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) {
      return [];
    }

    const cacheKey = `${CACHE_PREFIX_SEARCH}${normalizedQuery}`;

    // 1. Check cache
    const cached = this.cache.get<TickerSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Fetch from API with retries
    const results = await this.fetchWithRetry(() => this.apiClient.searchTickers(normalizedQuery));

    // 3. Cache
    this.cache.set(cacheKey, results, SEARCH_TTL_MS);

    return results;
  }

  /**
   * Determine the cache TTL based on the time range.
   * Short ranges (1W, 1M) use 5-min TTL (latest prices change frequently).
   * Longer ranges (3M+) use 24-hour TTL (historical data is stable).
   */
  private getTtlForRange(range: TimeRange): number {
    switch (range) {
      case '1W':
      case '1M':
        return LATEST_PRICES_TTL_MS;
      case '3M':
      case '6M':
      case '1Y':
      case 'ALL':
        return HISTORICAL_PRICES_TTL_MS;
      default:
        return LATEST_PRICES_TTL_MS;
    }
  }

  /**
   * Execute a fetch function with exponential backoff retry.
   * Retries up to MAX_RETRIES times (3 retries = 4 total attempts).
   */
  private async fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
