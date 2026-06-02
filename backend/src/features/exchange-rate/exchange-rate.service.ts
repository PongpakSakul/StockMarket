import { ExchangeRate } from '../../types';
import { InMemoryCache } from '../../cache/in-memory-cache';
import { IExchangeRateProvider } from '../portfolio/portfolio.service';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const CACHE_KEY = 'exchange-rate:USD_THB';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

// ────────────────────────────────────────────────────────────
// HTTP Client Interface (for dependency injection / testing)
// ────────────────────────────────────────────────────────────

export interface IHttpClient {
  fetchRate(): Promise<{ rate: number; fetchedAt: string }>;
}

// ────────────────────────────────────────────────────────────
// Fallback Rate Store Interface (simulates PostgreSQL cached rate)
// ────────────────────────────────────────────────────────────

export interface IFallbackRateStore {
  getLastKnownRate(): Promise<ExchangeRate | null>;
  saveRate(rate: ExchangeRate): Promise<void>;
}

// ────────────────────────────────────────────────────────────
// Exchange Rate Service
// ────────────────────────────────────────────────────────────

export class ExchangeRateService implements IExchangeRateProvider {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly cache: InMemoryCache,
    private readonly fallbackStore: IFallbackRateStore,
  ) {}

  /**
   * Fetch the current USD/THB exchange rate.
   *
   * Strategy:
   * 1. Check in-memory cache (30-min TTL)
   * 2. If cache miss, fetch from external API with retry (2 retries, exponential backoff)
   * 3. If API fails, return cached rate from fallback store with isStale: true
   *
   * Requirements: 10.1, 10.2, 10.5, 10.6
   */
  async getCurrentRate(): Promise<ExchangeRate> {
    // 1. Check in-memory cache
    const cached = this.cache.get<ExchangeRate>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    // 2. Fetch from external API with retries
    try {
      const result = await this.fetchWithRetry();
      const exchangeRate: ExchangeRate = {
        currencyPair: 'USD/THB',
        rate: result.rate,
        fetchedAt: result.fetchedAt,
        isStale: false,
      };

      // Cache the fresh rate
      this.cache.set(CACHE_KEY, exchangeRate, CACHE_TTL_MS);

      // Persist to fallback store
      await this.fallbackStore.saveRate(exchangeRate);

      return exchangeRate;
    } catch {
      // 3. API failed — fallback to stored rate
      const fallbackRate = await this.fallbackStore.getLastKnownRate();
      if (fallbackRate) {
        return {
          ...fallbackRate,
          isStale: true,
        };
      }

      // No fallback available — throw
      throw new Error('Unable to fetch exchange rate and no cached rate available');
    }
  }

  /**
   * Convert a USD amount to THB using the current exchange rate.
   *
   * Requirements: 10.1, 10.3
   */
  async convertUSDToTHB(amountUSD: number): Promise<number> {
    const rate = await this.getCurrentRate();
    return amountUSD * rate.rate;
  }

  /**
   * Fetch rate from external API with exponential backoff retry.
   * Retries up to MAX_RETRIES times.
   */
  private async fetchWithRetry(): Promise<{ rate: number; fetchedAt: string }> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.httpClient.fetchRate();
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
