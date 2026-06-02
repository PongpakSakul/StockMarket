import request from 'supertest';
import express from 'express';
import { createExchangeRateRouter, ExchangeRateRouterDeps } from './exchange-rate';
import { IHttpClient, IFallbackRateStore } from '../services/exchange-rate-service';
import { ExchangeRate } from '../types';
import { InMemoryCache } from '../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

function createMockDeps(overrides: Partial<ExchangeRateRouterDeps> = {}): ExchangeRateRouterDeps {
  const mockHttpClient: IHttpClient = {
    fetchRate: jest.fn().mockResolvedValue({
      rate: 35.5,
      fetchedAt: '2024-01-15T10:00:00Z',
    }),
  };

  const mockFallbackStore: IFallbackRateStore = {
    getLastKnownRate: jest.fn().mockResolvedValue(null),
    saveRate: jest.fn().mockResolvedValue(undefined),
  };

  return {
    httpClient: mockHttpClient,
    fallbackStore: mockFallbackStore,
    cache: new InMemoryCache(),
    ...overrides,
  };
}

function createTestApp(overrides: Partial<ExchangeRateRouterDeps> = {}) {
  const deps = createMockDeps(overrides);
  const router = createExchangeRateRouter(deps);

  const app = express();
  app.use(express.json());
  app.use('/api/exchange-rate', router);

  return { app, ...deps };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Exchange Rate API Endpoints', () => {
  describe('GET /api/exchange-rate/usd-thb', () => {
    it('should return the current exchange rate', async () => {
      const { app } = createTestApp();

      const res = await request(app).get('/api/exchange-rate/usd-thb');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currencyPair', 'USD/THB');
      expect(res.body).toHaveProperty('rate', 35.5);
      expect(res.body).toHaveProperty('fetchedAt', '2024-01-15T10:00:00Z');
      expect(res.body).toHaveProperty('isStale', false);
    });

    it('should return cached rate on subsequent requests', async () => {
      const mockHttpClient: IHttpClient = {
        fetchRate: jest.fn().mockResolvedValue({
          rate: 35.5,
          fetchedAt: '2024-01-15T10:00:00Z',
        }),
      };

      const { app } = createTestApp({ httpClient: mockHttpClient });

      // First request — fetches from API
      await request(app).get('/api/exchange-rate/usd-thb');
      expect(mockHttpClient.fetchRate).toHaveBeenCalledTimes(1);

      // Second request — should use cache
      await request(app).get('/api/exchange-rate/usd-thb');
      expect(mockHttpClient.fetchRate).toHaveBeenCalledTimes(1);
    });

    it('should return stale rate from fallback store when API fails', async () => {
      const staleRate: ExchangeRate = {
        currencyPair: 'USD/THB',
        rate: 34.8,
        fetchedAt: '2024-01-14T10:00:00Z',
        isStale: false,
      };

      const mockHttpClient: IHttpClient = {
        fetchRate: jest.fn().mockRejectedValue(new Error('API timeout')),
      };

      const mockFallbackStore: IFallbackRateStore = {
        getLastKnownRate: jest.fn().mockResolvedValue(staleRate),
        saveRate: jest.fn().mockResolvedValue(undefined),
      };

      const { app } = createTestApp({
        httpClient: mockHttpClient,
        fallbackStore: mockFallbackStore,
      });

      const res = await request(app).get('/api/exchange-rate/usd-thb');

      expect(res.status).toBe(200);
      expect(res.body.currencyPair).toBe('USD/THB');
      expect(res.body.rate).toBe(34.8);
      expect(res.body.isStale).toBe(true);
    });

    it('should return 503 with FX_RATE_UNAVAILABLE when API fails and no fallback', async () => {
      const mockHttpClient: IHttpClient = {
        fetchRate: jest.fn().mockRejectedValue(new Error('API timeout')),
      };

      const mockFallbackStore: IFallbackRateStore = {
        getLastKnownRate: jest.fn().mockResolvedValue(null),
        saveRate: jest.fn().mockResolvedValue(undefined),
      };

      const { app } = createTestApp({
        httpClient: mockHttpClient,
        fallbackStore: mockFallbackStore,
      });

      const res = await request(app).get('/api/exchange-rate/usd-thb');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('FX_RATE_UNAVAILABLE');
      expect(res.body.retryable).toBe(true);
      expect(res.body.message).toBeDefined();
    });

    it('should persist fetched rate to fallback store', async () => {
      const mockFallbackStore: IFallbackRateStore = {
        getLastKnownRate: jest.fn().mockResolvedValue(null),
        saveRate: jest.fn().mockResolvedValue(undefined),
      };

      const { app } = createTestApp({ fallbackStore: mockFallbackStore });

      await request(app).get('/api/exchange-rate/usd-thb');

      expect(mockFallbackStore.saveRate).toHaveBeenCalledWith(
        expect.objectContaining({
          currencyPair: 'USD/THB',
          rate: 35.5,
          isStale: false,
        }),
      );
    });
  });
});
