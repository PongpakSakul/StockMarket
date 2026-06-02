import { Router, Request, Response } from 'express';
import {
  PortfolioService,
  ITransactionProvider,
  IPriceProvider,
  IExchangeRateProvider,
  IDividendProvider,
} from './portfolio.service';
import { APIError, TimeRange } from '../../types';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const SUMMARY_CACHE_TTL_MS = 60_000; // 1 minute
const ALLOCATION_CACHE_TTL_MS = 60_000; // 1 minute
const PERFORMANCE_CACHE_TTL_MS = 60_000; // 1 minute

const VALID_TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

// ────────────────────────────────────────────────────────────
// Factory to create router with injected dependencies (for testing)
// ────────────────────────────────────────────────────────────

export interface PortfolioRouterDeps {
  transactionProvider: ITransactionProvider;
  priceProvider: IPriceProvider;
  exchangeRateProvider: IExchangeRateProvider;
  dividendProvider: IDividendProvider;
  cache?: InMemoryCache;
}

export function createPortfolioRouter(deps: PortfolioRouterDeps): Router {
  const portfolioService = new PortfolioService(
    deps.transactionProvider,
    deps.priceProvider,
    deps.exchangeRateProvider,
    deps.dividendProvider,
  );
  const cache = deps.cache ?? appCache;
  const router = Router();

  /**
   * GET /api/portfolio/summary
   *
   * Returns the full portfolio summary including holdings, P/L, and exchange rate.
   * Cached for 1 minute per user. Invalidated when a new transaction is created.
   *
   * Requirements: 5.1, 7.2
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const cacheKey = `portfolio:summary:${userId}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const summary = await portfolioService.getSummary(userId);
      cache.set(cacheKey, summary, SUMMARY_CACHE_TTL_MS);

      res.status(200).json(summary);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching portfolio summary',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * GET /api/portfolio/allocation
   *
   * Returns asset allocation percentages for the portfolio.
   * Cached for 1 minute per user.
   *
   * Requirements: 5.4
   */
  router.get('/allocation', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const cacheKey = `portfolio:allocation:${userId}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const allocation = await portfolioService.getAllocation(userId);
      cache.set(cacheKey, allocation, ALLOCATION_CACHE_TTL_MS);

      res.status(200).json(allocation);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching portfolio allocation',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * GET /api/portfolio/performance?range={timeRange}&benchmark={index}
   *
   * Returns performance comparison between portfolio and a benchmark index.
   *
   * Query params:
   *   - range: TimeRange (1W, 1M, 3M, 6M, 1Y, ALL) — defaults to '1Y'
   *   - benchmark: benchmark index ticker — defaults to 'SPY'
   *
   * Requirements: 5.5, 7.2
   */
  router.get('/performance', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';

      // Parse and validate range
      const rangeParam = req.query.range ? String(req.query.range) : '1Y';
      if (!VALID_TIME_RANGES.includes(rangeParam as TimeRange)) {
        const apiError: APIError = {
          code: 'INVALID_RANGE',
          message: `Invalid time range. Must be one of: ${VALID_TIME_RANGES.join(', ')}`,
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }
      const range = rangeParam as TimeRange;

      // Parse benchmark
      const benchmark = req.query.benchmark
        ? String(req.query.benchmark).toUpperCase()
        : 'SPY';

      const cacheKey = `portfolio:performance:${userId}:${range}:${benchmark}`;

      const cached = cache.get(cacheKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }

      const performance = await portfolioService.getPerformance(userId, range, benchmark);
      cache.set(cacheKey, performance, PERFORMANCE_CACHE_TTL_MS);

      res.status(200).json(performance);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching portfolio performance',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * POST /api/portfolio/invalidate-cache
   *
   * Invalidates all portfolio caches for the current user.
   * Called internally when a new transaction is created/updated/deleted.
   *
   * Requirements: 7.2
   */
  router.post('/invalidate-cache', (req: Request, res: Response) => {
    const userId = (req.headers['x-user-id'] as string) || 'default-user';
    cache.invalidateByPrefix(`portfolio:summary:${userId}`);
    cache.invalidateByPrefix(`portfolio:allocation:${userId}`);
    cache.invalidateByPrefix(`portfolio:performance:${userId}`);
    res.status(204).send();
  });

  return router;
}

// ────────────────────────────────────────────────────────────
// Default export — uses stub providers (for development/testing)
// In production, wire real providers in app.ts
// ────────────────────────────────────────────────────────────

// Stub providers for default export (no-op implementations)
const stubTransactionProvider: ITransactionProvider = {
  getTransactionsForUser: async () => [],
  getTransactionsByTicker: async () => [],
};

const stubPriceProvider: IPriceProvider = {
  getCurrentPrices: async () => new Map(),
  getTickerName: async (ticker: string) => ticker,
  getHistoricalPrices: async () => new Map(),
};

const stubExchangeRateProvider: IExchangeRateProvider = {
  getCurrentRate: async () => ({
    currencyPair: 'USD/THB',
    rate: 35.0,
    fetchedAt: new Date().toISOString(),
    isStale: false,
  }),
};

const stubDividendProvider: IDividendProvider = {
  getTotalDividendsForUser: async () => 0,
  getDividendsByTicker: async () => 0,
  getAnnualDividends: async () => 0,
};

export default createPortfolioRouter({
  transactionProvider: stubTransactionProvider,
  priceProvider: stubPriceProvider,
  exchangeRateProvider: stubExchangeRateProvider,
  dividendProvider: stubDividendProvider,
});
