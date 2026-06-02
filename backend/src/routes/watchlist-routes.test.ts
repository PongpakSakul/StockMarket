import request from 'supertest';
import express from 'express';
import { createWatchlistRouter, WatchlistRouterDeps } from './watchlist-routes';
import { IFinancialApiClient } from '../services/chart-service';
import { OHLCData, StockInfo, TickerSearchResult } from '../types';
import { InMemoryCache } from '../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

const sampleStockInfoVOO: StockInfo = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  type: 'etf',
  exchange: 'NYSE',
  currency: 'USD',
  currentPrice: 450.0,
  previousClose: 445.0,
  marketCap: 350000000000,
};

const sampleStockInfoAAPL: StockInfo = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  type: 'stock',
  exchange: 'NASDAQ',
  currency: 'USD',
  currentPrice: 180.0,
  previousClose: 175.0,
  marketCap: 2800000000000,
};

const sampleStockInfoMSFT: StockInfo = {
  ticker: 'MSFT',
  name: 'Microsoft Corporation',
  type: 'stock',
  exchange: 'NASDAQ',
  currency: 'USD',
  currentPrice: 420.0,
  previousClose: 425.0,
  marketCap: 3100000000000,
};

const sampleOHLC: OHLCData[] = [
  { time: '2024-01-15', open: 420.0, high: 425.5, low: 418.0, close: 423.0, volume: 1500000 },
  { time: '2024-01-16', open: 423.0, high: 428.0, low: 421.0, close: 427.5, volume: 1200000 },
  { time: '2024-01-17', open: 427.5, high: 430.0, low: 425.0, close: 429.0, volume: 1100000 },
  { time: '2024-01-18', open: 429.0, high: 432.0, low: 427.0, close: 431.0, volume: 1300000 },
  { time: '2024-01-19', open: 431.0, high: 435.0, low: 430.0, close: 434.0, volume: 1400000 },
];

function createMockApiClient(overrides: Partial<IFinancialApiClient> = {}): IFinancialApiClient {
  return {
    fetchPrices: jest.fn().mockResolvedValue(sampleOHLC),
    fetchStockInfo: jest.fn().mockImplementation((ticker: string) => {
      switch (ticker) {
        case 'VOO':
          return Promise.resolve(sampleStockInfoVOO);
        case 'AAPL':
          return Promise.resolve(sampleStockInfoAAPL);
        case 'MSFT':
          return Promise.resolve(sampleStockInfoMSFT);
        default:
          return Promise.reject(new Error(`Unknown ticker: ${ticker}`));
      }
    }),
    searchTickers: jest.fn().mockResolvedValue([] as TickerSearchResult[]),
    ...overrides,
  };
}

function createTestApp(overrides: Partial<WatchlistRouterDeps> = {}) {
  const apiClient = overrides.apiClient ?? createMockApiClient();
  const cache = overrides.cache ?? new InMemoryCache();
  const router = createWatchlistRouter({ apiClient, cache, watchlistService: overrides.watchlistService });

  const app = express();
  app.use(express.json());
  app.use('/api/watchlist', router);

  return { app, apiClient, cache };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Watchlist API Endpoints', () => {
  describe('GET /api/watchlist', () => {
    it('should return empty array when watchlist is empty', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/watchlist');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all watchlist items with price data', async () => {
      const { app } = createTestApp();

      // Add items first
      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      await request(app).post('/api/watchlist').send({ ticker: 'AAPL' });

      const res = await request(app).get('/api/watchlist');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const voo = res.body.find((i: any) => i.tickerSymbol === 'VOO');
      expect(voo).toBeDefined();
      expect(voo.tickerName).toBe('Vanguard S&P 500 ETF');
      expect(voo.currentPrice).toBe(450.0);
      expect(voo.priceChangeAmount).toBeCloseTo(5.0, 2);
      expect(voo.priceChangePercent).toBeCloseTo((5.0 / 445.0) * 100, 2);
      expect(Array.isArray(voo.sparklineData)).toBe(true);
    });

    it('should support sorting by ticker ascending', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      await request(app).post('/api/watchlist').send({ ticker: 'AAPL' });
      await request(app).post('/api/watchlist').send({ ticker: 'MSFT' });

      const res = await request(app).get('/api/watchlist?sortBy=ticker&sortOrder=asc');

      expect(res.status).toBe(200);
      const tickers = res.body.map((i: any) => i.tickerSymbol);
      expect(tickers).toEqual(['AAPL', 'MSFT', 'VOO']);
    });

    it('should support sorting by price descending', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      await request(app).post('/api/watchlist').send({ ticker: 'AAPL' });
      await request(app).post('/api/watchlist').send({ ticker: 'MSFT' });

      const res = await request(app).get('/api/watchlist?sortBy=price&sortOrder=desc');

      expect(res.status).toBe(200);
      const prices = res.body.map((i: any) => i.currentPrice);
      expect(prices).toEqual([450.0, 420.0, 180.0]);
    });

    it('should support sorting by percentChange ascending', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      await request(app).post('/api/watchlist').send({ ticker: 'AAPL' });
      await request(app).post('/api/watchlist').send({ ticker: 'MSFT' });

      const res = await request(app).get('/api/watchlist?sortBy=percentChange&sortOrder=asc');

      expect(res.status).toBe(200);
      const percents = res.body.map((i: any) => i.priceChangePercent);
      // MSFT is negative, VOO is positive, AAPL is most positive
      expect(percents[0]).toBeLessThan(percents[1]);
      expect(percents[1]).toBeLessThan(percents[2]);
    });

    it('should reject invalid sortBy field', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/watchlist?sortBy=invalid');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SORT_FIELD');
      expect(res.body.retryable).toBe(false);
    });

    it('should reject invalid sortOrder', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/watchlist?sortOrder=invalid');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SORT_ORDER');
      expect(res.body.retryable).toBe(false);
    });
  });

  describe('POST /api/watchlist', () => {
    it('should add a valid ticker and return 201 with watchlist item', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({ ticker: 'VOO' });

      expect(res.status).toBe(201);
      expect(res.body.tickerSymbol).toBe('VOO');
      expect(res.body.tickerName).toBe('Vanguard S&P 500 ETF');
      expect(res.body.currentPrice).toBe(450.0);
      expect(res.body).toHaveProperty('priceChangeAmount');
      expect(res.body).toHaveProperty('priceChangePercent');
      expect(res.body).toHaveProperty('sparklineData');
    });

    it('should return 400 when ticker is missing from body', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
      expect(res.body.retryable).toBe(false);
    });

    it('should return 400 when ticker is not a string', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({ ticker: 123 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    });

    it('should return 400 when ticker is empty string', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({ ticker: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    });

    it('should return 409 when ticker is already in watchlist', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      const res = await request(app).post('/api/watchlist').send({ ticker: 'VOO' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_WATCHLIST');
      expect(res.body.retryable).toBe(false);
    });

    it('should return 400 for invalid ticker not recognized by Financial API', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({ ticker: 'INVALIDXYZ' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    }, 15000);

    it('should normalize ticker to uppercase', async () => {
      const { app } = createTestApp();

      const res = await request(app).post('/api/watchlist').send({ ticker: 'voo' });

      expect(res.status).toBe(201);
      expect(res.body.tickerSymbol).toBe('VOO');
    });
  });

  describe('DELETE /api/watchlist/:ticker', () => {
    it('should remove an existing ticker and return 204', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      const res = await request(app).delete('/api/watchlist/VOO');

      expect(res.status).toBe(204);

      // Verify it's gone
      const listRes = await request(app).get('/api/watchlist');
      expect(listRes.body).toHaveLength(0);
    });

    it('should return 404 when ticker is not in watchlist', async () => {
      const { app } = createTestApp();

      const res = await request(app).delete('/api/watchlist/VOO');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.retryable).toBe(false);
    });

    it('should normalize ticker to uppercase for deletion', async () => {
      const { app } = createTestApp();

      await request(app).post('/api/watchlist').send({ ticker: 'VOO' });
      const res = await request(app).delete('/api/watchlist/voo');

      expect(res.status).toBe(204);

      const listRes = await request(app).get('/api/watchlist');
      expect(listRes.body).toHaveLength(0);
    });
  });
});
