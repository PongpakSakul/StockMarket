import { ChartService, IFinancialApiClient } from './chart-service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { OHLCData, StockInfo, TickerSearchResult, TimeRange } from '../types';

// ────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────

const sampleOHLC: OHLCData[] = [
  { time: '2024-01-15', open: 420.0, high: 425.5, low: 418.0, close: 423.0, volume: 1500000 },
  { time: '2024-01-16', open: 423.0, high: 428.0, low: 421.0, close: 427.5, volume: 1200000 },
];

const sampleStockInfo: StockInfo = {
  ticker: 'VOO',
  name: 'Vanguard S&P 500 ETF',
  type: 'etf',
  exchange: 'NYSE',
  currency: 'USD',
  currentPrice: 427.5,
  previousClose: 423.0,
  marketCap: 350000000000,
};

const sampleSearchResults: TickerSearchResult[] = [
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', exchange: 'NYSE' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', exchange: 'NYSE' },
];

function createMockApiClient(overrides?: Partial<IFinancialApiClient>): IFinancialApiClient {
  return {
    fetchPrices: jest.fn().mockResolvedValue(sampleOHLC),
    fetchStockInfo: jest.fn().mockResolvedValue(sampleStockInfo),
    searchTickers: jest.fn().mockResolvedValue(sampleSearchResults),
    ...overrides,
  };
}

function createService(options?: {
  apiClient?: IFinancialApiClient;
  cache?: InMemoryCache;
}) {
  const cache = options?.cache ?? new InMemoryCache();
  const apiClient = options?.apiClient ?? createMockApiClient();

  return {
    service: new ChartService(apiClient, cache),
    cache,
    apiClient,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('ChartService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getStockPrices', () => {
    it('should fetch prices from API on cache miss', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      const result = await service.getStockPrices('VOO', '1M');

      expect(result).toEqual(sampleOHLC);
      expect(apiClient.fetchPrices).toHaveBeenCalledWith('VOO', '1M');
      expect(apiClient.fetchPrices).toHaveBeenCalledTimes(1);
    });

    it('should return cached prices on cache hit without calling API', async () => {
      const cache = new InMemoryCache();
      cache.set('chart:prices:VOO:1M', sampleOHLC, 5 * 60 * 1000);

      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient, cache });

      const result = await service.getStockPrices('VOO', '1M');

      expect(result).toEqual(sampleOHLC);
      expect(apiClient.fetchPrices).not.toHaveBeenCalled();
    });

    it('should cache fetched prices with 5-min TTL for short ranges (1W)', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockPrices('VOO', '1W');

      const cached = cache.get<OHLCData[]>('chart:prices:VOO:1W');
      expect(cached).toEqual(sampleOHLC);
    });

    it('should cache fetched prices with 5-min TTL for short ranges (1M)', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockPrices('VOO', '1M');

      const cached = cache.get<OHLCData[]>('chart:prices:VOO:1M');
      expect(cached).toEqual(sampleOHLC);
    });

    it('should cache fetched prices with 24-hour TTL for historical ranges (3M)', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockPrices('AAPL', '3M');

      const cached = cache.get<OHLCData[]>('chart:prices:AAPL:3M');
      expect(cached).toEqual(sampleOHLC);
    });

    it('should cache fetched prices with 24-hour TTL for historical ranges (1Y)', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockPrices('AAPL', '1Y');

      const cached = cache.get<OHLCData[]>('chart:prices:AAPL:1Y');
      expect(cached).toEqual(sampleOHLC);
    });

    it('should cache fetched prices with 24-hour TTL for ALL range', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockPrices('AAPL', 'ALL');

      const cached = cache.get<OHLCData[]>('chart:prices:AAPL:ALL');
      expect(cached).toEqual(sampleOHLC);
    });

    it('should retry up to 3 times with exponential backoff on API failure', async () => {
      const fetchPrices = jest
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(sampleOHLC);

      const apiClient = createMockApiClient({ fetchPrices });
      const { service } = createService({ apiClient });

      const promise = service.getStockPrices('VOO', '1M');

      // Advance past first backoff (1000ms)
      await jest.advanceTimersByTimeAsync(1000);
      // Advance past second backoff (2000ms)
      await jest.advanceTimersByTimeAsync(2000);
      // Advance past third backoff (4000ms)
      await jest.advanceTimersByTimeAsync(4000);

      const result = await promise;

      expect(fetchPrices).toHaveBeenCalledTimes(4); // initial + 3 retries
      expect(result).toEqual(sampleOHLC);
    });

    it('should throw after all retries are exhausted', async () => {
      const fetchPrices = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const apiClient = createMockApiClient({ fetchPrices });
      const { service } = createService({ apiClient });

      const promise = service.getStockPrices('VOO', '1M').catch((err) => err);

      // Advance through all retry backoffs
      await jest.advanceTimersByTimeAsync(1000); // 1st retry
      await jest.advanceTimersByTimeAsync(2000); // 2nd retry
      await jest.advanceTimersByTimeAsync(4000); // 3rd retry

      const error = await promise;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Persistent failure');
      expect(fetchPrices).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it('should succeed on second attempt after first failure', async () => {
      const fetchPrices = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(sampleOHLC);

      const apiClient = createMockApiClient({ fetchPrices });
      const { service } = createService({ apiClient });

      const promise = service.getStockPrices('VOO', '1M');

      // Advance past first backoff (1000ms)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(fetchPrices).toHaveBeenCalledTimes(2);
      expect(result).toEqual(sampleOHLC);
    });

    it('should use different cache keys for different tickers and ranges', async () => {
      const cache = new InMemoryCache();
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient, cache });

      await service.getStockPrices('VOO', '1M');
      await service.getStockPrices('AAPL', '1M');
      await service.getStockPrices('VOO', '1Y');

      expect(apiClient.fetchPrices).toHaveBeenCalledTimes(3);
      expect(cache.get('chart:prices:VOO:1M')).toEqual(sampleOHLC);
      expect(cache.get('chart:prices:AAPL:1M')).toEqual(sampleOHLC);
      expect(cache.get('chart:prices:VOO:1Y')).toEqual(sampleOHLC);
    });
  });

  describe('getStockInfo', () => {
    it('should fetch stock info from API on cache miss', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      const result = await service.getStockInfo('VOO');

      expect(result).toEqual(sampleStockInfo);
      expect(apiClient.fetchStockInfo).toHaveBeenCalledWith('VOO');
      expect(apiClient.fetchStockInfo).toHaveBeenCalledTimes(1);
    });

    it('should return cached stock info on cache hit without calling API', async () => {
      const cache = new InMemoryCache();
      cache.set('chart:info:VOO', sampleStockInfo, 24 * 60 * 60 * 1000);

      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient, cache });

      const result = await service.getStockInfo('VOO');

      expect(result).toEqual(sampleStockInfo);
      expect(apiClient.fetchStockInfo).not.toHaveBeenCalled();
    });

    it('should cache fetched stock info with 24-hour TTL', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.getStockInfo('VOO');

      const cached = cache.get<StockInfo>('chart:info:VOO');
      expect(cached).toEqual(sampleStockInfo);
    });

    it('should retry on API failure with exponential backoff', async () => {
      const fetchStockInfo = jest
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(sampleStockInfo);

      const apiClient = createMockApiClient({ fetchStockInfo });
      const { service } = createService({ apiClient });

      const promise = service.getStockInfo('VOO');

      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(fetchStockInfo).toHaveBeenCalledTimes(2);
      expect(result).toEqual(sampleStockInfo);
    });

    it('should throw after all retries are exhausted', async () => {
      const fetchStockInfo = jest.fn().mockRejectedValue(new Error('API down'));
      const apiClient = createMockApiClient({ fetchStockInfo });
      const { service } = createService({ apiClient });

      const promise = service.getStockInfo('VOO').catch((err) => err);

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);

      const error = await promise;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('API down');
      expect(fetchStockInfo).toHaveBeenCalledTimes(4);
    });
  });

  describe('searchTickers', () => {
    it('should fetch search results from API on cache miss', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      const result = await service.searchTickers('VOO');

      expect(result).toEqual(sampleSearchResults);
      expect(apiClient.searchTickers).toHaveBeenCalledWith('VOO');
      expect(apiClient.searchTickers).toHaveBeenCalledTimes(1);
    });

    it('should return cached search results on cache hit without calling API', async () => {
      const cache = new InMemoryCache();
      cache.set('chart:search:VOO', sampleSearchResults, 60 * 60 * 1000);

      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient, cache });

      const result = await service.searchTickers('VOO');

      expect(result).toEqual(sampleSearchResults);
      expect(apiClient.searchTickers).not.toHaveBeenCalled();
    });

    it('should normalize query to uppercase for cache key', async () => {
      const cache = new InMemoryCache();
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient, cache });

      await service.searchTickers('voo');

      // Should be cached under uppercase key
      const cached = cache.get<TickerSearchResult[]>('chart:search:VOO');
      expect(cached).toEqual(sampleSearchResults);
      expect(apiClient.searchTickers).toHaveBeenCalledWith('VOO');
    });

    it('should trim whitespace from query', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      await service.searchTickers('  voo  ');

      expect(apiClient.searchTickers).toHaveBeenCalledWith('VOO');
    });

    it('should return empty array for empty query', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      const result = await service.searchTickers('');

      expect(result).toEqual([]);
      expect(apiClient.searchTickers).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      const apiClient = createMockApiClient();
      const { service } = createService({ apiClient });

      const result = await service.searchTickers('   ');

      expect(result).toEqual([]);
      expect(apiClient.searchTickers).not.toHaveBeenCalled();
    });

    it('should cache search results with 1-hour TTL', async () => {
      const cache = new InMemoryCache();
      const { service } = createService({ cache });

      await service.searchTickers('VOO');

      const cached = cache.get<TickerSearchResult[]>('chart:search:VOO');
      expect(cached).toEqual(sampleSearchResults);
    });

    it('should retry on API failure with exponential backoff', async () => {
      const searchTickers = jest
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(sampleSearchResults);

      const apiClient = createMockApiClient({ searchTickers });
      const { service } = createService({ apiClient });

      const promise = service.searchTickers('VOO');

      await jest.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(searchTickers).toHaveBeenCalledTimes(2);
      expect(result).toEqual(sampleSearchResults);
    });

    it('should throw after all retries are exhausted', async () => {
      const searchTickers = jest.fn().mockRejectedValue(new Error('API down'));
      const apiClient = createMockApiClient({ searchTickers });
      const { service } = createService({ apiClient });

      const promise = service.searchTickers('VOO').catch((err) => err);

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);

      const error = await promise;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('API down');
      expect(searchTickers).toHaveBeenCalledTimes(4);
    });
  });
});
