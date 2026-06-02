import { ExchangeRateService, IHttpClient, IFallbackRateStore } from './exchange-rate-service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { ExchangeRate } from '../types';

// ────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────

function createMockHttpClient(overrides?: Partial<IHttpClient>): IHttpClient {
  return {
    fetchRate: jest.fn().mockResolvedValue({
      rate: 35.5,
      fetchedAt: '2024-01-15T10:00:00Z',
    }),
    ...overrides,
  };
}

function createMockFallbackStore(overrides?: Partial<IFallbackRateStore>): IFallbackRateStore {
  return {
    getLastKnownRate: jest.fn().mockResolvedValue(null),
    saveRate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createService(options?: {
  httpClient?: IHttpClient;
  cache?: InMemoryCache;
  fallbackStore?: IFallbackRateStore;
}) {
  const cache = options?.cache ?? new InMemoryCache();
  const httpClient = options?.httpClient ?? createMockHttpClient();
  const fallbackStore = options?.fallbackStore ?? createMockFallbackStore();

  return {
    service: new ExchangeRateService(httpClient, cache, fallbackStore),
    cache,
    httpClient,
    fallbackStore,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('ExchangeRateService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getCurrentRate', () => {
    it('should fetch rate from API on cache miss', async () => {
      const httpClient = createMockHttpClient();
      const { service } = createService({ httpClient });

      const result = await service.getCurrentRate();

      expect(result).toEqual({
        currencyPair: 'USD/THB',
        rate: 35.5,
        fetchedAt: '2024-01-15T10:00:00Z',
        isStale: false,
      });
      expect(httpClient.fetchRate).toHaveBeenCalledTimes(1);
    });

    it('should return cached rate on cache hit without calling API', async () => {
      const cache = new InMemoryCache();
      const cachedRate: ExchangeRate = {
        currencyPair: 'USD/THB',
        rate: 34.8,
        fetchedAt: '2024-01-15T09:30:00Z',
        isStale: false,
      };
      cache.set('exchange-rate:USD_THB', cachedRate, 30 * 60 * 1000);

      const httpClient = createMockHttpClient();
      const { service } = createService({ httpClient, cache });

      const result = await service.getCurrentRate();

      expect(result).toEqual(cachedRate);
      expect(httpClient.fetchRate).not.toHaveBeenCalled();
    });

    it('should cache the fetched rate with 30-min TTL', async () => {
      const cache = new InMemoryCache();
      const httpClient = createMockHttpClient();
      const { service } = createService({ httpClient, cache });

      await service.getCurrentRate();

      // Rate should be in cache
      const cached = cache.get<ExchangeRate>('exchange-rate:USD_THB');
      expect(cached).toEqual({
        currencyPair: 'USD/THB',
        rate: 35.5,
        fetchedAt: '2024-01-15T10:00:00Z',
        isStale: false,
      });
    });

    it('should persist fetched rate to fallback store', async () => {
      const fallbackStore = createMockFallbackStore();
      const { service } = createService({ fallbackStore });

      await service.getCurrentRate();

      expect(fallbackStore.saveRate).toHaveBeenCalledWith({
        currencyPair: 'USD/THB',
        rate: 35.5,
        fetchedAt: '2024-01-15T10:00:00Z',
        isStale: false,
      });
    });

    it('should return stale rate from fallback store when API fails', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockRejectedValue(new Error('API timeout')),
      });
      const staleRate: ExchangeRate = {
        currencyPair: 'USD/THB',
        rate: 34.0,
        fetchedAt: '2024-01-14T10:00:00Z',
        isStale: false,
      };
      const fallbackStore = createMockFallbackStore({
        getLastKnownRate: jest.fn().mockResolvedValue(staleRate),
      });

      const { service } = createService({ httpClient, fallbackStore });

      const promise = service.getCurrentRate();

      // Advance through retry backoffs
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toEqual({
        currencyPair: 'USD/THB',
        rate: 34.0,
        fetchedAt: '2024-01-14T10:00:00Z',
        isStale: true,
      });
    });

    it('should mark fallback rate as stale', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockRejectedValue(new Error('Network error')),
      });
      const fallbackStore = createMockFallbackStore({
        getLastKnownRate: jest.fn().mockResolvedValue({
          currencyPair: 'USD/THB',
          rate: 33.5,
          fetchedAt: '2024-01-13T10:00:00Z',
          isStale: false,
        }),
      });

      const { service } = createService({ httpClient, fallbackStore });

      const promise = service.getCurrentRate();

      // Advance through retry backoffs
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.isStale).toBe(true);
    });

    it('should throw when API fails and no fallback rate is available', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockRejectedValue(new Error('API down')),
      });
      const fallbackStore = createMockFallbackStore({
        getLastKnownRate: jest.fn().mockResolvedValue(null),
      });

      const { service } = createService({ httpClient, fallbackStore });

      const promise = service.getCurrentRate().catch((err) => err);

      // Advance through retry backoffs
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const error = await promise;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'Unable to fetch exchange rate and no cached rate available',
      );
    });

    it('should retry up to 2 times with exponential backoff on API failure', async () => {
      const fetchRate = jest
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ rate: 35.0, fetchedAt: '2024-01-15T10:00:00Z' });

      const httpClient = createMockHttpClient({ fetchRate });
      const { service } = createService({ httpClient });

      // Start the getCurrentRate call
      const promise = service.getCurrentRate();

      // Advance past first backoff (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      // Advance past second backoff (2000ms)
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(fetchRate).toHaveBeenCalledTimes(3);
      expect(result.rate).toBe(35.0);
      expect(result.isStale).toBe(false);
    });

    it('should fall back to stored rate after all retries are exhausted', async () => {
      const fetchRate = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const httpClient = createMockHttpClient({ fetchRate });
      const fallbackStore = createMockFallbackStore({
        getLastKnownRate: jest.fn().mockResolvedValue({
          currencyPair: 'USD/THB',
          rate: 34.5,
          fetchedAt: '2024-01-14T08:00:00Z',
          isStale: false,
        }),
      });

      const { service } = createService({ httpClient, fallbackStore });

      const promise = service.getCurrentRate();

      // Advance through all retry backoffs
      await jest.advanceTimersByTimeAsync(1000); // first retry backoff
      await jest.advanceTimersByTimeAsync(2000); // second retry backoff

      const result = await promise;

      // 3 attempts total: initial + 2 retries
      expect(fetchRate).toHaveBeenCalledTimes(3);
      expect(result.isStale).toBe(true);
      expect(result.rate).toBe(34.5);
    });

    it('should succeed on second attempt after first failure', async () => {
      const fetchRate = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ rate: 36.0, fetchedAt: '2024-01-15T11:00:00Z' });

      const httpClient = createMockHttpClient({ fetchRate });
      const { service } = createService({ httpClient });

      const promise = service.getCurrentRate();

      // Advance past first backoff (1000ms)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(fetchRate).toHaveBeenCalledTimes(2);
      expect(result.rate).toBe(36.0);
      expect(result.isStale).toBe(false);
    });
  });

  describe('convertUSDToTHB', () => {
    it('should multiply USD amount by exchange rate', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockResolvedValue({
          rate: 35.0,
          fetchedAt: '2024-01-15T10:00:00Z',
        }),
      });
      const { service } = createService({ httpClient });

      const result = await service.convertUSDToTHB(100);

      expect(result).toBe(3500);
    });

    it('should return 0 for 0 USD', async () => {
      const { service } = createService();

      const result = await service.convertUSDToTHB(0);

      expect(result).toBe(0);
    });

    it('should handle fractional amounts correctly', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockResolvedValue({
          rate: 35.25,
          fetchedAt: '2024-01-15T10:00:00Z',
        }),
      });
      const { service } = createService({ httpClient });

      const result = await service.convertUSDToTHB(10.5);

      expect(result).toBeCloseTo(370.125, 2);
    });

    it('should use cached rate for conversion', async () => {
      const cache = new InMemoryCache();
      const cachedRate: ExchangeRate = {
        currencyPair: 'USD/THB',
        rate: 34.0,
        fetchedAt: '2024-01-15T09:00:00Z',
        isStale: false,
      };
      cache.set('exchange-rate:USD_THB', cachedRate, 30 * 60 * 1000);

      const httpClient = createMockHttpClient();
      const { service } = createService({ httpClient, cache });

      const result = await service.convertUSDToTHB(50);

      expect(result).toBe(1700);
      expect(httpClient.fetchRate).not.toHaveBeenCalled();
    });

    it('should use stale rate for conversion when API fails', async () => {
      const httpClient = createMockHttpClient({
        fetchRate: jest.fn().mockRejectedValue(new Error('API down')),
      });
      const fallbackStore = createMockFallbackStore({
        getLastKnownRate: jest.fn().mockResolvedValue({
          currencyPair: 'USD/THB',
          rate: 33.0,
          fetchedAt: '2024-01-13T10:00:00Z',
          isStale: false,
        }),
      });

      const { service } = createService({ httpClient, fallbackStore });

      const promise = service.convertUSDToTHB(200);

      // Advance through retries
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe(6600); // 200 * 33.0
    });
  });
});
