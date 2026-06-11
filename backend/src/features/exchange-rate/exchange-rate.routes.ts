import { Router, Request, Response } from 'express';
import { ExchangeRateService, IHttpClient, IFallbackRateStore } from './exchange-rate.service';
import { APIError } from '../../types';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';
import { YahooFinanceExchangeRateClient } from './yahoo-exchange-rate.client';

// ────────────────────────────────────────────────────────────
// Factory to create router with injected dependencies (for testing)
// ────────────────────────────────────────────────────────────

export interface ExchangeRateRouterDeps {
  httpClient: IHttpClient;
  fallbackStore: IFallbackRateStore;
  cache?: InMemoryCache;
}

export function createExchangeRateRouter(deps: ExchangeRateRouterDeps): Router {
  const cache = deps.cache ?? appCache;
  const service = new ExchangeRateService(deps.httpClient, cache, deps.fallbackStore);
  const router = Router();

  /**
   * GET /api/exchange-rate/usd-thb
   *
   * Returns the current USD/THB exchange rate.
   * Response shape: { currencyPair, rate, fetchedAt, isStale }
   *
   * Requirements: 10.1, 10.5
   */
  router.get('/usd-thb', async (_req: Request, res: Response) => {
    try {
      const exchangeRate = await service.getCurrentRate();
      res.status(200).json(exchangeRate);
    } catch {
      const apiError: APIError = {
        code: 'FX_RATE_UNAVAILABLE',
        message: 'Unable to fetch exchange rate. Please try again later.',
        retryable: true,
      };
      res.status(503).json(apiError);
    }
  });

  return router;
}

import { PostgresFallbackRateStore } from './postgres-fallback-rate.store';

// ────────────────────────────────────────────────────────────
// Default export — uses Yahoo Finance API (for production)
// ────────────────────────────────────────────────────────────

const realHttpClient = new YahooFinanceExchangeRateClient();
const postgresFallbackStore = new PostgresFallbackRateStore();

export default createExchangeRateRouter({
  httpClient: realHttpClient,
  fallbackStore: postgresFallbackStore,
});
