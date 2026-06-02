import request from 'supertest';
import express from 'express';
import { createPortfolioRouter, PortfolioRouterDeps } from './portfolio';
import {
  ITransactionProvider,
  IPriceProvider,
  IExchangeRateProvider,
  IDividendProvider,
} from '../services/portfolio-service';
import { Transaction, ExchangeRate } from '../types';
import { InMemoryCache } from '../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    userId: 'user-1',
    tickerSymbol: 'AAPL',
    transactionDate: '2024-01-15',
    pricePerShare: 185.0,
    shares: 10,
    totalAmount: 1850.0,
    source: 'manual',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

function createMockProviders(overrides: Partial<PortfolioRouterDeps> = {}): PortfolioRouterDeps {
  const mockTransactionProvider: ITransactionProvider = {
    getTransactionsForUser: jest.fn().mockResolvedValue([]),
    getTransactionsByTicker: jest.fn().mockResolvedValue([]),
  };

  const mockPriceProvider: IPriceProvider = {
    getCurrentPrices: jest.fn().mockResolvedValue(new Map()),
    getTickerName: jest.fn().mockImplementation(async (ticker: string) => ticker),
    getHistoricalPrices: jest.fn().mockResolvedValue(new Map()),
  };

  const mockExchangeRateProvider: IExchangeRateProvider = {
    getCurrentRate: jest.fn().mockResolvedValue({
      currencyPair: 'USD/THB',
      rate: 35.0,
      fetchedAt: '2024-01-15T00:00:00Z',
      isStale: false,
    } as ExchangeRate),
  };

  const mockDividendProvider: IDividendProvider = {
    getTotalDividendsForUser: jest.fn().mockResolvedValue(0),
    getDividendsByTicker: jest.fn().mockResolvedValue(0),
    getAnnualDividends: jest.fn().mockResolvedValue(0),
  };

  return {
    transactionProvider: mockTransactionProvider,
    priceProvider: mockPriceProvider,
    exchangeRateProvider: mockExchangeRateProvider,
    dividendProvider: mockDividendProvider,
    cache: new InMemoryCache(),
    ...overrides,
  };
}

function createTestApp(deps?: Partial<PortfolioRouterDeps>) {
  const providers = createMockProviders(deps);
  const router = createPortfolioRouter(providers);

  const app = express();
  app.use(express.json());
  app.use('/api/portfolio', router);

  return { app, ...providers };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Portfolio API Endpoints', () => {
  describe('GET /api/portfolio/summary', () => {
    it('should return portfolio summary for user', async () => {
      const transactions = [
        createMockTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1850, pricePerShare: 185 }),
        createMockTransaction({ id: 'txn-2', tickerSymbol: 'VOO', shares: 5, totalAmount: 2100, pricePerShare: 420 }),
      ];

      const currentPrices = new Map([['AAPL', 190.0], ['VOO', 430.0]]);

      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
        priceProvider: {
          getCurrentPrices: jest.fn().mockResolvedValue(currentPrices),
          getTickerName: jest.fn().mockImplementation(async (ticker: string) => ticker),
          getHistoricalPrices: jest.fn().mockResolvedValue(new Map()),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/summary')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalValueUSD');
      expect(res.body).toHaveProperty('totalValueTHB');
      expect(res.body).toHaveProperty('totalCostBasis');
      expect(res.body).toHaveProperty('unrealizedPLUSD');
      expect(res.body).toHaveProperty('unrealizedPLTHB');
      expect(res.body).toHaveProperty('unrealizedPLPercent');
      expect(res.body).toHaveProperty('totalDividendsReceived');
      expect(res.body).toHaveProperty('totalReturnUSD');
      expect(res.body).toHaveProperty('totalReturnPercent');
      expect(res.body).toHaveProperty('dividendYieldPercent');
      expect(res.body).toHaveProperty('exchangeRate');
      expect(res.body).toHaveProperty('holdings');
      expect(res.body.holdings).toHaveLength(2);
    });

    it('should return empty portfolio when no transactions exist', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/portfolio/summary')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.totalValueUSD).toBe(0);
      expect(res.body.holdings).toHaveLength(0);
    });

    it('should use default user when x-user-id header is missing', async () => {
      const { app, transactionProvider } = createTestApp();

      await request(app).get('/api/portfolio/summary');

      expect(transactionProvider.getTransactionsForUser).toHaveBeenCalledWith('default-user');
    });

    it('should cache summary results for 1 minute', async () => {
      const transactions = [
        createMockTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1850 }),
      ];

      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      // First request — should call the provider
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);

      // Second request — should use cache
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);
    });

    it('should return 500 on service error', async () => {
      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockRejectedValue(new Error('DB connection failed')),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/summary')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
      expect(res.body.retryable).toBe(true);
    });
  });

  describe('GET /api/portfolio/allocation', () => {
    it('should return asset allocation for user', async () => {
      const transactions = [
        createMockTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1850, pricePerShare: 185 }),
        createMockTransaction({ id: 'txn-2', tickerSymbol: 'VOO', shares: 5, totalAmount: 2100, pricePerShare: 420 }),
      ];

      const currentPrices = new Map([['AAPL', 190.0], ['VOO', 430.0]]);

      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
        priceProvider: {
          getCurrentPrices: jest.fn().mockResolvedValue(currentPrices),
          getTickerName: jest.fn().mockImplementation(async (ticker: string) => ticker),
          getHistoricalPrices: jest.fn().mockResolvedValue(new Map()),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/allocation')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      // Check structure
      for (const item of res.body) {
        expect(item).toHaveProperty('tickerSymbol');
        expect(item).toHaveProperty('tickerName');
        expect(item).toHaveProperty('valueUSD');
        expect(item).toHaveProperty('percentage');
      }

      // Percentages should sum to ~100%
      const totalPercentage = res.body.reduce(
        (sum: number, item: { percentage: number }) => sum + item.percentage,
        0,
      );
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('should return empty array when no transactions exist', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/portfolio/allocation')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should cache allocation results', async () => {
      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue([]),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      await request(app).get('/api/portfolio/allocation').set('x-user-id', 'user-1');
      await request(app).get('/api/portfolio/allocation').set('x-user-id', 'user-1');

      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);
    });

    it('should return 500 on service error', async () => {
      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockRejectedValue(new Error('DB error')),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/allocation')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/portfolio/performance', () => {
    it('should return performance data with default params', async () => {
      const transactions = [
        createMockTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1850, pricePerShare: 185 }),
      ];

      const historicalPrices = new Map([
        ['2024-01-01', 180.0],
        ['2024-06-01', 195.0],
      ]);

      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
        priceProvider: {
          getCurrentPrices: jest.fn().mockResolvedValue(new Map([['AAPL', 195.0]])),
          getTickerName: jest.fn().mockImplementation(async (ticker: string) => ticker),
          getHistoricalPrices: jest.fn().mockResolvedValue(historicalPrices),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/performance')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('range', '1Y');
      expect(res.body).toHaveProperty('benchmark', 'SPY');
      expect(res.body).toHaveProperty('dataPoints');
      expect(res.body).toHaveProperty('portfolioTotalReturn');
      expect(res.body).toHaveProperty('benchmarkTotalReturn');
    });

    it('should accept custom range and benchmark params', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/portfolio/performance?range=3M&benchmark=QQQ')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.range).toBe('3M');
      expect(res.body.benchmark).toBe('QQQ');
    });

    it('should reject invalid time range', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/portfolio/performance?range=INVALID')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_RANGE');
      expect(res.body.retryable).toBe(false);
    });

    it('should cache performance results', async () => {
      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue([]),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      await request(app).get('/api/portfolio/performance?range=1M').set('x-user-id', 'user-1');
      await request(app).get('/api/portfolio/performance?range=1M').set('x-user-id', 'user-1');

      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);
    });

    it('should not share cache between different ranges', async () => {
      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue([]),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      await request(app).get('/api/portfolio/performance?range=1M').set('x-user-id', 'user-1');
      await request(app).get('/api/portfolio/performance?range=3M').set('x-user-id', 'user-1');

      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(2);
    });

    it('should return 500 on service error', async () => {
      const { app } = createTestApp({
        transactionProvider: {
          getTransactionsForUser: jest.fn().mockRejectedValue(new Error('Service error')),
          getTransactionsByTicker: jest.fn().mockResolvedValue([]),
        },
      });

      const res = await request(app)
        .get('/api/portfolio/performance')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/portfolio/invalidate-cache', () => {
    it('should invalidate cache for the user', async () => {
      const transactions = [
        createMockTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1850 }),
      ];

      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      // First request — populates cache
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);

      // Invalidate cache
      const invalidateRes = await request(app)
        .post('/api/portfolio/invalidate-cache')
        .set('x-user-id', 'user-1');
      expect(invalidateRes.status).toBe(204);

      // Next request should call provider again
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(2);
    });

    it('should not invalidate cache for other users', async () => {
      const mockTransactionProvider: ITransactionProvider = {
        getTransactionsForUser: jest.fn().mockResolvedValue([]),
        getTransactionsByTicker: jest.fn().mockResolvedValue([]),
      };

      const { app } = createTestApp({
        transactionProvider: mockTransactionProvider,
      });

      // Populate cache for user-1
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);

      // Invalidate cache for user-2
      await request(app)
        .post('/api/portfolio/invalidate-cache')
        .set('x-user-id', 'user-2');

      // user-1 cache should still be valid
      await request(app).get('/api/portfolio/summary').set('x-user-id', 'user-1');
      expect(mockTransactionProvider.getTransactionsForUser).toHaveBeenCalledTimes(1);
    });
  });
});
