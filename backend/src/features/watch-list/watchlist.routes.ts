import { Router, Request, Response } from 'express';
import { WatchlistService, WatchlistError, WatchlistSortField, WatchlistSortOrder } from './watchlist-service';
import { ChartService, IFinancialApiClient } from '../charts/chart.service';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';
import { APIError } from '../../types';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const VALID_SORT_FIELDS: WatchlistSortField[] = ['ticker', 'price', 'percentChange'];
const VALID_SORT_ORDERS: WatchlistSortOrder[] = ['asc', 'desc'];

// ────────────────────────────────────────────────────────────
// Factory to create router with injected dependencies (for testing)
// ────────────────────────────────────────────────────────────

export interface WatchlistRouterDeps {
  apiClient: IFinancialApiClient;
  cache?: InMemoryCache;
  watchlistService?: WatchlistService;
}

export function createWatchlistRouter(deps: WatchlistRouterDeps): Router {
  const cache = deps.cache ?? appCache;
  const chartService = new ChartService(deps.apiClient, cache);
  const watchlistService = deps.watchlistService ?? new WatchlistService(chartService);
  const router = Router();

  /**
   * GET /api/watchlist
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      // Parse and validate sort options
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const sortOrder = req.query.sortOrder ? String(req.query.sortOrder) : undefined;

      // Validate query parameters before calling service
      if (sortBy && !VALID_SORT_FIELDS.includes(sortBy as WatchlistSortField)) {
        const apiError: APIError = {
          code: 'INVALID_SORT_FIELD',
          message: `Invalid sort field. Must be one of: ${VALID_SORT_FIELDS.join(', ')}`,
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      if (sortOrder && !VALID_SORT_ORDERS.includes(sortOrder as WatchlistSortOrder)) {
        const apiError: APIError = {
          code: 'INVALID_SORT_ORDER',
          message: `Invalid sort order. Must be one of: ${VALID_SORT_ORDERS.join(', ')}`,
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const items = await watchlistService.getWatchlist(userId, {
        sortBy: sortBy as WatchlistSortField | undefined,
        sortOrder: sortOrder as WatchlistSortOrder | undefined,
      });

      res.status(200).json(items);
    } catch (err) {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'Unable to fetch watchlist. Please try again later.',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * POST /api/watchlist
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const { ticker } = req.body;

      if (!ticker || typeof ticker !== 'string') {
        const apiError: APIError = {
          code: 'INVALID_TICKER',
          message: 'Request body must include a "ticker" field (string)',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const item = await watchlistService.addToWatchlist(userId, ticker);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof WatchlistError) {
        switch (err.code) {
          case 'INVALID_TICKER': {
            const apiError: APIError = {
              code: 'INVALID_TICKER',
              message: err.message,
              retryable: false,
            };
            res.status(400).json(apiError);
            return;
          }
          case 'DUPLICATE_WATCHLIST': {
            const apiError: APIError = {
              code: 'DUPLICATE_WATCHLIST',
              message: err.message,
              retryable: false,
            };
            res.status(409).json(apiError);
            return;
          }
        }
      }

      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'Unable to add ticker to watchlist. Please try again later.',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * DELETE /api/watchlist/:ticker
   */
  router.delete('/:ticker', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const ticker = req.params.ticker as string;

      if (!ticker) {
        const apiError: APIError = {
          code: 'INVALID_TICKER',
          message: 'Ticker symbol is required',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      await watchlistService.removeFromWatchlist(userId, ticker);
      res.status(204).send();
    } catch (err) {
      if (err instanceof WatchlistError) {
        switch (err.code) {
          case 'NOT_FOUND': {
            const apiError: APIError = {
              code: 'NOT_FOUND',
              message: err.message,
              retryable: false,
            };
            res.status(404).json(apiError);
            return;
          }
        }
      }

      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'Unable to remove ticker from watchlist. Please try again later.',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  return router;
}

// ────────────────────────────────────────────────────────────
// Default export — uses stub API client (for development)
// In production, wire a real API client in app.ts
// ────────────────────────────────────────────────────────────

import { YahooFinanceClient } from '../charts/yahoo-finance.client';
import { PostgresWatchlistRepository } from './postgres-watchlist.repository';

export default createWatchlistRouter({
  apiClient: new YahooFinanceClient(),
  watchlistService: new WatchlistService(new ChartService(new YahooFinanceClient(), appCache), new PostgresWatchlistRepository()),
});
