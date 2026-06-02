import { Router, Request, Response } from 'express';
import { DividendService } from './service';
import { InMemoryDividendRepository } from './repository';
import { InMemoryTransactionRepository } from '../../repositories/transaction-repository';
import { DividendFilters, APIError, TimeRange } from '../../types';
import { ValidationError } from '../../services/transaction-service';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';

const defaultDividendRepository = new InMemoryDividendRepository();
const defaultTransactionRepository = new InMemoryTransactionRepository();
const defaultService = new DividendService(defaultDividendRepository, defaultTransactionRepository);

export interface DividendsRouterDeps {
  service?: DividendService;
  cache?: InMemoryCache;
}

export function createDividendsRouter(depsOrService?: DividendsRouterDeps | DividendService): Router {
  let dividendService: DividendService;
  let cache: InMemoryCache;

  if (depsOrService instanceof DividendService) {
    dividendService = depsOrService;
    cache = appCache;
  } else {
    dividendService = depsOrService?.service ?? defaultService;
    cache = depsOrService?.cache ?? appCache;
  }

  const router = Router();

  function invalidatePortfolioCache(userId: string): void {
    cache.invalidateByPrefix(`portfolio:summary:${userId}`);
    cache.invalidateByPrefix(`portfolio:allocation:${userId}`);
    cache.invalidateByPrefix(`portfolio:performance:${userId}`);
  }

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const range = (req.query.range as string) || '1Y';

      const validRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];
      if (!validRanges.includes(range as TimeRange)) {
        const apiError: APIError = {
          code: 'INVALID_RANGE',
          message: `Invalid time range "${range}". Valid values: ${validRanges.join(', ')}`,
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const summary = await dividendService.getDividendSummary(userId, range as TimeRange);
      res.status(200).json(summary);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching dividend summary',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const filters: DividendFilters = {};

      if (req.query.ticker) {
        filters.tickerSymbol = String(req.query.ticker).toUpperCase();
      }
      if (req.query.from) {
        filters.fromDate = String(req.query.from);
      }
      if (req.query.to) {
        filters.toDate = String(req.query.to);
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

      const result = await dividendService.getDividends(userId, filters);
      res.status(200).json(result);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching dividends',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const { tickerSymbol, dividendDate, amountPerShare, totalAmount, sharesHeld } = req.body;

      if (
        !tickerSymbol ||
        !dividendDate ||
        amountPerShare === undefined ||
        totalAmount === undefined ||
        sharesHeld === undefined
      ) {
        const apiError: APIError = {
          code: 'INVALID_AMOUNT',
          message:
            'Missing required fields: tickerSymbol, dividendDate, amountPerShare, totalAmount, sharesHeld',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const dividend = await dividendService.createDividend({
        userId,
        tickerSymbol: String(tickerSymbol).toUpperCase(),
        dividendDate: String(dividendDate),
        amountPerShare: Number(amountPerShare),
        totalAmount: Number(totalAmount),
        sharesHeld: Number(sharesHeld),
      });

      invalidatePortfolioCache(userId);

      res.status(201).json(dividend);
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
        message: 'An unexpected error occurred while creating the dividend',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const id = req.params.id as string;
      const { tickerSymbol, dividendDate, amountPerShare, totalAmount, sharesHeld } = req.body;

      const updateData: Record<string, unknown> = {};
      if (tickerSymbol !== undefined) updateData.tickerSymbol = String(tickerSymbol).toUpperCase();
      if (dividendDate !== undefined) updateData.dividendDate = String(dividendDate);
      if (amountPerShare !== undefined) updateData.amountPerShare = Number(amountPerShare);
      if (totalAmount !== undefined) updateData.totalAmount = Number(totalAmount);
      if (sharesHeld !== undefined) updateData.sharesHeld = Number(sharesHeld);

      const dividend = await dividendService.updateDividend(id, userId, updateData);

      invalidatePortfolioCache(userId);

      res.status(200).json(dividend);
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
        message: 'An unexpected error occurred while updating the dividend',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default-user';
      const id = req.params.id as string;

      await dividendService.deleteDividend(id, userId);

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
        message: 'An unexpected error occurred while deleting the dividend',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  return router;
}

function getStatusCodeForValidationError(code: string): number {
  switch (code) {
    case 'INVALID_TICKER':
    case 'INVALID_DATE':
    case 'INVALID_AMOUNT':
    case 'INVALID_RANGE':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'TICKER_NOT_HELD':
      return 400;
    default:
      return 400;
  }
}

export default createDividendsRouter();
