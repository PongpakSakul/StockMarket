import request from 'supertest';
import express from 'express';
import { createStockRouter, StockRouterDeps } from './stock-routes';
import { IFinancialApiClient } from '../services/chart-service';
import { OHLCData, StockInfo, TickerSearchResult, TimeRange } from '../types';
import { InMemoryCache } from '../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

function createMockApiClient(overrides: Partial<IFinancialApiClient> = {}): IFinancialApiClient {
  return {
    fetchPrices: jest.fn().mockResolvedValue([
      { time: '2024-01-15', open: 185.0, high: 187.0, low: 184.0, close: 186.0, volume: 1000000 },
      { time: '2024-01-16', open: 186.0, high: 188.0, low: 185.0, close: 187.5, volume: 1200000 },
    ] as OHLCData[]),
    fetchStockInfo: jest.fn().mockResolvedValue({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      type: 'stock',
      exchange: 'NASDAQ',
      currency: 'USD',
      currentPrice: 186.0,
      previousClose: 185.0,
      marketCap: 2900000000000,
    } as StockInfo),
    searchTickers: jest.fn().mockResolvedValue([
      { ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', exchange: 'NASDAQ' },
    ] as TickerSearchResult[]),
    ...overrides,
  };
}

function createTestApp(overrides: Partial<StockRouterDeps> = {}) {
  const apiClient = createMockApiClient(overrides.apiClient as Partial<IFinancialApiClient>);
  const cache = overrides.cache ?? new InMemoryCache();
  const router = createStockRouter({ apiClient, cache });

  const app = express();
  app.use(express.json());
  app.use('/api/stocks', router);

  return { app, apiClient, cache };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Stock API Endpoints', () => {
  describe('GET /api/stocks/:ticker/prices', () => {
    it('should return OHLC price data for a valid ticker', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/AAPL/prices?range=1M');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('time');
      expect(res.body[0]).toHaveProperty('open');
      expect(res.body[0]).toHaveProperty('high');
      expect(res.body[0]).toHaveProperty('low');
      expect(res.body[0]).toHaveProperty('close');
      expect(res.body[0]).toHaveProperty('volume');
    });

    it('should default to 1M range when no range is specified', async () => {
      const mockClient = createMockApiClient();
      const { app } = createTestApp({ apiClient: mockClient });

      await request(app).get('/api/stocks/AAPL/prices');

      expect(mockClient.fetchPrices).toHaveBeenCalledWith('AAPL', '1M');
    });

    it('should uppercase the ticker symbol', async () => {
      const mockClient = createMockApiClient();
      const { app } = createTestApp({ apiClient: mockClient });

      await request(app).get('/api/stocks/aapl/prices?range=1W');

      expect(mockClient.fetchPrices).toHaveBeenCalledWith('AAPL', '1W');
    });

    it('should accept all valid time ranges', async () => {
      const validRanges: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

      for (const range of validRanges) {
        const { app } = createTestApp();
        const res = await request(app).get(`/api/stocks/VOO/prices?range=${range}`);
        expect(res.status).toBe(200);
      }
    });

    it('should reject invalid time range', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/AAPL/prices?range=INVALID');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_RANGE');
      expect(res.body.retryable).toBe(false);
    });

    it('should return 503 when API client fails', async () => {
      const mockClient = createMockApiClient({
        fetchPrices: jest.fn().mockRejectedValue(new Error('API timeout')),
      });
      const { app } = createTestApp({ apiClient: mockClient });

      const res = await request(app).get('/api/stocks/AAPL/prices?range=1M');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('API_UNAVAILABLE');
      expect(res.body.retryable).toBe(true);
    }, 15000);

    it('should cache price data on subsequent requests', async () => {
      const mockClient = createMockApiClient();
      const cache = new InMemoryCache();
      const { app } = createTestApp({ apiClient: mockClient, cache });

      // First request
      await request(app).get('/api/stocks/AAPL/prices?range=1M');
      // Second request — should use cache
      await request(app).get('/api/stocks/AAPL/prices?range=1M');

      // ChartService internally caches, so fetchPrices should only be called once
      expect(mockClient.fetchPrices).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/stocks/:ticker/info', () => {
    it('should return stock info for a valid ticker', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/AAPL/info');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ticker', 'AAPL');
      expect(res.body).toHaveProperty('name', 'Apple Inc.');
      expect(res.body).toHaveProperty('type', 'stock');
      expect(res.body).toHaveProperty('exchange', 'NASDAQ');
      expect(res.body).toHaveProperty('currency', 'USD');
      expect(res.body).toHaveProperty('currentPrice');
      expect(res.body).toHaveProperty('previousClose');
      expect(res.body).toHaveProperty('marketCap');
    });

    it('should uppercase the ticker symbol', async () => {
      const mockClient = createMockApiClient();
      const { app } = createTestApp({ apiClient: mockClient });

      await request(app).get('/api/stocks/voo/info');

      expect(mockClient.fetchStockInfo).toHaveBeenCalledWith('VOO');
    });

    it('should return 503 when API client fails', async () => {
      const mockClient = createMockApiClient({
        fetchStockInfo: jest.fn().mockRejectedValue(new Error('API error')),
      });
      const { app } = createTestApp({ apiClient: mockClient });

      const res = await request(app).get('/api/stocks/AAPL/info');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('API_UNAVAILABLE');
      expect(res.body.retryable).toBe(true);
    }, 15000);

    it('should cache stock info on subsequent requests', async () => {
      const mockClient = createMockApiClient();
      const cache = new InMemoryCache();
      const { app } = createTestApp({ apiClient: mockClient, cache });

      await request(app).get('/api/stocks/AAPL/info');
      await request(app).get('/api/stocks/AAPL/info');

      expect(mockClient.fetchStockInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/stocks/search', () => {
    it('should return search results for a valid query', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/search?q=A');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('ticker');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('type');
      expect(res.body[0]).toHaveProperty('exchange');
    });

    it('should return empty array when query is empty', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/search?q=');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return empty array when q param is missing', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/stocks/search');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 503 when API client fails', async () => {
      const mockClient = createMockApiClient({
        searchTickers: jest.fn().mockRejectedValue(new Error('API error')),
      });
      const { app } = createTestApp({ apiClient: mockClient });

      const res = await request(app).get('/api/stocks/search?q=AAPL');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('API_UNAVAILABLE');
      expect(res.body.retryable).toBe(true);
    }, 15000);

    it('should pass query to chart service', async () => {
      const mockClient = createMockApiClient();
      const { app } = createTestApp({ apiClient: mockClient });

      await request(app).get('/api/stocks/search?q=apple');

      // ChartService normalizes to uppercase internally
      expect(mockClient.searchTickers).toHaveBeenCalledWith('APPLE');
    });
  });
});
