import { Router, Request, Response } from 'express';
import { TransactionService, ValidationError } from './transaction.service';
import { InMemoryTransactionRepository } from './transaction.repository';
import { TransactionFilters, APIError } from '../../types';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';
import { resolveUserId } from '../../db/constants';

import { PostgresTransactionRepository } from './postgres-transaction.repository';

// ────────────────────────────────────────────────────────────
// Default repository & service (can be overridden via factory)
// ────────────────────────────────────────────────────────────

const defaultRepository = new PostgresTransactionRepository();
const defaultService = new TransactionService(defaultRepository);

// ────────────────────────────────────────────────────────────
// Factory to create router with injected service (for testing)
// ────────────────────────────────────────────────────────────

export interface TransactionsRouterDeps {
  service?: TransactionService;
  cache?: InMemoryCache;
}

export function createTransactionsRouter(depsOrService?: TransactionsRouterDeps | TransactionService): Router {
  // Support both old signature (service only) and new deps object
  let txnService: TransactionService;
  let cache: InMemoryCache;

  if (depsOrService instanceof TransactionService) {
    txnService = depsOrService;
    cache = appCache;
  } else {
    txnService = depsOrService?.service ?? defaultService;
    cache = depsOrService?.cache ?? appCache;
  }

  const router = Router();

  /**
   * Invalidate all portfolio caches for a given user.
   * Called after transaction create/update/delete to ensure fresh portfolio data.
   * Requirements: 5.6, 7.2
   */
  function invalidatePortfolioCache(userId: string): void {
    cache.invalidateByPrefix(`portfolio:summary:${userId}`);
    cache.invalidateByPrefix(`portfolio:allocation:${userId}`);
    cache.invalidateByPrefix(`portfolio:performance:${userId}`);
  }

  /**
   * GET /api/transactions
   *
   * Query params:
   *   - ticker: filter by ticker symbol
   *   - from: filter by start date (ISO 8601)
   *   - to: filter by end date (ISO 8601)
   *   - sort: sort field (date | ticker | amount)
   *   - order: sort direction (asc | desc)
   *   - page: page number (default 1)
   *   - pageSize: items per page (default 20)
   *
   * Requirements: 6.5, 6.6
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filters: TransactionFilters = {};

      if (req.query.ticker) {
        filters.tickerSymbol = String(req.query.ticker).toUpperCase();
      }
      if (req.query.from) {
        filters.fromDate = String(req.query.from);
      }
      if (req.query.to) {
        filters.toDate = String(req.query.to);
      }
      if (req.query.sort) {
        const sortBy = String(req.query.sort);
        if (['date', 'ticker', 'amount'].includes(sortBy)) {
          filters.sortBy = sortBy as 'date' | 'ticker' | 'amount';
        }
      }
      if (req.query.order) {
        const order = String(req.query.order);
        if (['asc', 'desc'].includes(order)) {
          filters.sortOrder = order as 'asc' | 'desc';
        }
      }
      if (req.query.page) {
        const page = parseInt(String(req.query.page), 10);
        if (!isNaN(page) && page > 0) {
          filters.page = page;
        }
      }
      if (req.query.pageSize) {
        const pageSize = parseInt(String(req.query.pageSize), 10);
        if (!isNaN(pageSize) && pageSize > 0 && pageSize <= 100) {
          filters.pageSize = pageSize;
        }
      }

      const result = await txnService.getTransactions(filters);
      res.status(200).json(result);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching transactions',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * GET /api/transactions/buy-points/:ticker
   *
   * Get aggregated buy points for a specific ticker to display on charts.
   */
  router.get('/buy-points/:ticker', async (req: Request, res: Response) => {
    try {
      const ticker = String(req.params.ticker).toUpperCase();
      const userId = resolveUserId(req.headers['x-user-id'] as string);
      
      const buyPoints = await txnService.getBuyPointsForTicker(ticker, userId);
      res.status(200).json(buyPoints);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching buy points',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * POST /api/transactions
   *
   * Body: { tickerSymbol, transactionDate, pricePerShare, shares, totalAmount, source?, slipImageUrl?, ocrRawText? }
   *
   * Requirements: 6.1, 6.2
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { tickerSymbol, transactionDate, pricePerShare, shares, totalAmount, source, slipImageUrl, ocrRawText } = req.body;

      // Basic presence validation
      if (!tickerSymbol || !transactionDate || pricePerShare === undefined || shares === undefined || totalAmount === undefined) {
        const apiError: APIError = {
          code: 'INVALID_AMOUNT',
          message: 'Missing required fields: tickerSymbol, transactionDate, pricePerShare, shares, totalAmount',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const userId = resolveUserId(req.headers['x-user-id'] as string);
      const transaction = await txnService.createTransaction({
        userId,
        tickerSymbol: String(tickerSymbol).toUpperCase(),
        transactionDate: String(transactionDate),
        pricePerShare: Number(pricePerShare),
        shares: Number(shares),
        totalAmount: Number(totalAmount),
        source: source || 'manual',
        slipImageUrl,
        ocrRawText,
      });

      // Invalidate portfolio cache after successful create (Req 5.6, 7.2)
      invalidatePortfolioCache(userId);

      res.status(201).json(transaction);
    } catch (err) {
      if (err instanceof ValidationError) {
        const statusCode = getStatusCodeForValidationError(err.code);
        const apiError: APIError = {
          code: err.code,
          message: err.message,
          retryable: false,
        };
        res.status(statusCode).json(apiError);
        return;
      }

      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while creating the transaction',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * PUT /api/transactions/:id
   *
   * Body: { tickerSymbol?, transactionDate?, pricePerShare?, shares?, totalAmount?, source? }
   *
   * Requirements: 6.3
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req.headers['x-user-id'] as string);
      const id = req.params.id as string;
      const { tickerSymbol, transactionDate, pricePerShare, shares, totalAmount, source } = req.body;

      const updateData: Record<string, unknown> = {};
      if (tickerSymbol !== undefined) updateData.tickerSymbol = String(tickerSymbol).toUpperCase();
      if (transactionDate !== undefined) updateData.transactionDate = String(transactionDate);
      if (pricePerShare !== undefined) updateData.pricePerShare = Number(pricePerShare);
      if (shares !== undefined) updateData.shares = Number(shares);
      if (totalAmount !== undefined) updateData.totalAmount = Number(totalAmount);
      if (source !== undefined) updateData.source = source;

      const transaction = await txnService.updateTransaction(id, updateData);

      // Invalidate portfolio cache after successful update (Req 5.6, 6.4, 7.2)
      invalidatePortfolioCache(userId);

      res.status(200).json(transaction);
    } catch (err) {
      if (err instanceof ValidationError) {
        const statusCode = getStatusCodeForValidationError(err.code);
        const apiError: APIError = {
          code: err.code,
          message: err.message,
          retryable: false,
        };
        res.status(statusCode).json(apiError);
        return;
      }

      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while updating the transaction',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * DELETE /api/transactions/:id
   *
   * Requirements: 6.4
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req.headers['x-user-id'] as string);
      const id = req.params.id as string;
      await txnService.deleteTransaction(id);

      // Invalidate portfolio cache after successful delete (Req 5.6, 6.4, 7.2)
      invalidatePortfolioCache(userId);

      res.status(204).send();
    } catch (err) {
      if (err instanceof ValidationError) {
        const statusCode = getStatusCodeForValidationError(err.code);
        const apiError: APIError = {
          code: err.code,
          message: err.message,
          retryable: false,
        };
        res.status(statusCode).json(apiError);
        return;
      }

      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while deleting the transaction',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  return router;
}

// ────────────────────────────────────────────────────────────
// Helper: map validation error codes to HTTP status codes
// ────────────────────────────────────────────────────────────

function getStatusCodeForValidationError(code: string): number {
  switch (code) {
    case 'INVALID_TICKER':
    case 'INVALID_DATE':
    case 'INVALID_AMOUNT':
      return 400;
    case 'NOT_FOUND':
      return 404;
    default:
      return 400;
  }
}

// Default export for convenience
export default createTransactionsRouter();
