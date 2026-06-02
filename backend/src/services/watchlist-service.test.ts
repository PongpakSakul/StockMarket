import { WatchlistService, WatchlistError } from './watchlist-service';
import { ChartService, IFinancialApiClient } from './chart-service';
import { InMemoryCache } from '../cache/in-memory-cache';
import { OHLCData, StockInfo, TickerSearchResult } from '../types';

// ────────────────────────────────────────────────────────────
// Test Helpers
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

function createMockApiClient(overrides?: Partial<IFinancialApiClient>): IFinancialApiClient {
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

function createService(options?: { apiClient?: IFinancialApiClient }) {
  const cache = new InMemoryCache();
  const apiClient = options?.apiClient ?? createMockApiClient();
  const chartService = new ChartService(apiClient, cache);
  const watchlistService = new WatchlistService(chartService);

  return { watchlistService, chartService, apiClient, cache };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('WatchlistService', () => {
  // ──────────────────────────────────────────────────────────
  // addToWatchlist (Requirements 12.1, 12.2, 12.7)
  // ──────────────────────────────────────────────────────────

  describe('addToWatchlist', () => {
    it('adds a valid ticker and returns a WatchlistItem with live data', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('VOO');

      expect(item.tickerSymbol).toBe('VOO');
      expect(item.tickerName).toBe('Vanguard S&P 500 ETF');
      expect(item.currentPrice).toBe(450.0);
      expect(item.priceChangeAmount).toBeCloseTo(5.0, 2);
      expect(item.priceChangePercent).toBeCloseTo((5.0 / 445.0) * 100, 2);
      expect(Array.isArray(item.sparklineData)).toBe(true);
    });

    it('normalizes ticker to uppercase', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('voo');

      expect(item.tickerSymbol).toBe('VOO');
    });

    it('trims whitespace from ticker', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('  VOO  ');

      expect(item.tickerSymbol).toBe('VOO');
    });

    it('rejects empty ticker', async () => {
      const { watchlistService } = createService();

      await expect(watchlistService.addToWatchlist('')).rejects.toThrow(WatchlistError);
      await expect(watchlistService.addToWatchlist('')).rejects.toMatchObject({
        code: 'INVALID_TICKER',
      });
    });

    it('rejects whitespace-only ticker', async () => {
      const { watchlistService } = createService();

      await expect(watchlistService.addToWatchlist('   ')).rejects.toMatchObject({
        code: 'INVALID_TICKER',
      });
    });

    it('rejects duplicate ticker (Requirement 12.7)', async () => {
      const { watchlistService } = createService();

      await watchlistService.addToWatchlist('VOO');

      await expect(watchlistService.addToWatchlist('VOO')).rejects.toThrow(WatchlistError);
      await expect(watchlistService.addToWatchlist('VOO')).rejects.toMatchObject({
        code: 'DUPLICATE_WATCHLIST',
      });
    });

    it('rejects duplicate ticker regardless of case', async () => {
      const { watchlistService } = createService();

      await watchlistService.addToWatchlist('VOO');

      await expect(watchlistService.addToWatchlist('voo')).rejects.toMatchObject({
        code: 'DUPLICATE_WATCHLIST',
      });
    });

    it('rejects invalid ticker that Financial API does not recognize (Requirement 12.2)', async () => {
      // Use a mock that rejects only once (no retries needed)
      const apiClient = createMockApiClient({
        fetchStockInfo: jest.fn().mockImplementation((ticker: string) => {
          if (ticker === 'INVALIDXYZ') {
            return Promise.reject(new Error(`Unknown ticker: ${ticker}`));
          }
          return Promise.resolve(sampleStockInfoVOO);
        }),
      });
      // Create a ChartService with no retry delay by using real timers
      const cache = new InMemoryCache();
      const chartService = new ChartService(apiClient, cache);
      const watchlistService = new WatchlistService(chartService);

      let error: unknown;
      try {
        await watchlistService.addToWatchlist('INVALIDXYZ');
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(WatchlistError);
      expect((error as WatchlistError).code).toBe('INVALID_TICKER');
    }, 15000);

    it('validates ticker via ChartService.getStockInfo', async () => {
      const apiClient = createMockApiClient();
      const { watchlistService } = createService({ apiClient });

      await watchlistService.addToWatchlist('VOO');

      expect(apiClient.fetchStockInfo).toHaveBeenCalledWith('VOO');
    });

    it('returns sparkline data from 1W price history', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('VOO');

      expect(item.sparklineData).toEqual([423.0, 427.5, 429.0, 431.0, 434.0]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // removeFromWatchlist (Requirement 12.5)
  // ──────────────────────────────────────────────────────────

  describe('removeFromWatchlist', () => {
    it('removes an existing ticker from the watchlist', async () => {
      const { watchlistService } = createService();

      await watchlistService.addToWatchlist('VOO');
      await watchlistService.removeFromWatchlist('VOO');

      const items = await watchlistService.getWatchlist();
      expect(items).toHaveLength(0);
    });

    it('normalizes ticker to uppercase for removal', async () => {
      const { watchlistService } = createService();

      await watchlistService.addToWatchlist('VOO');
      await watchlistService.removeFromWatchlist('voo');

      const items = await watchlistService.getWatchlist();
      expect(items).toHaveLength(0);
    });

    it('throws NOT_FOUND for ticker not in watchlist', async () => {
      const { watchlistService } = createService();

      await expect(watchlistService.removeFromWatchlist('VOO')).rejects.toThrow(WatchlistError);
      await expect(watchlistService.removeFromWatchlist('VOO')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // getWatchlist (Requirements 12.1, 12.3, 12.6)
  // ──────────────────────────────────────────────────────────

  describe('getWatchlist', () => {
    it('returns empty array when watchlist is empty', async () => {
      const { watchlistService } = createService();

      const items = await watchlistService.getWatchlist();

      expect(items).toEqual([]);
    });

    it('returns all items with current price, daily change, and sparkline', async () => {
      const { watchlistService } = createService();

      await watchlistService.addToWatchlist('VOO');
      await watchlistService.addToWatchlist('AAPL');

      const items = await watchlistService.getWatchlist();

      expect(items).toHaveLength(2);

      const voo = items.find((i) => i.tickerSymbol === 'VOO')!;
      expect(voo.currentPrice).toBe(450.0);
      expect(voo.priceChangeAmount).toBeCloseTo(5.0, 2);
      expect(voo.priceChangePercent).toBeCloseTo((5.0 / 445.0) * 100, 2);
      expect(voo.sparklineData.length).toBeGreaterThan(0);

      const aapl = items.find((i) => i.tickerSymbol === 'AAPL')!;
      expect(aapl.currentPrice).toBe(180.0);
      expect(aapl.priceChangeAmount).toBeCloseTo(5.0, 2);
      expect(aapl.priceChangePercent).toBeCloseTo((5.0 / 175.0) * 100, 2);
    });

    it('handles sparkline fetch failure gracefully (returns empty sparkline)', async () => {
      jest.useFakeTimers();
      const apiClient = createMockApiClient({
        fetchPrices: jest.fn().mockRejectedValue(new Error('API down')),
      });
      const { watchlistService } = createService({ apiClient });

      const addPromise = watchlistService.addToWatchlist('VOO');
      // Advance through retry backoffs for fetchPrices (1s + 2s + 4s)
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);
      await addPromise;

      const getPromise = watchlistService.getWatchlist();
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);
      const items = await getPromise;

      expect(items).toHaveLength(1);
      expect(items[0].sparklineData).toEqual([]);

      jest.useRealTimers();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Sorting (Requirement 12.6)
  // ──────────────────────────────────────────────────────────

  describe('sorting', () => {
    async function setupMultipleItems() {
      const { watchlistService } = createService();
      await watchlistService.addToWatchlist('VOO');   // price: 450, change: +1.12%
      await watchlistService.addToWatchlist('AAPL');  // price: 180, change: +2.86%
      await watchlistService.addToWatchlist('MSFT');  // price: 420, change: -1.18%
      return watchlistService;
    }

    it('sorts by ticker ascending (default)', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'ticker', sortOrder: 'asc' });
      const tickers = items.map((i) => i.tickerSymbol);

      expect(tickers).toEqual(['AAPL', 'MSFT', 'VOO']);
    });

    it('sorts by ticker descending', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'ticker', sortOrder: 'desc' });
      const tickers = items.map((i) => i.tickerSymbol);

      expect(tickers).toEqual(['VOO', 'MSFT', 'AAPL']);
    });

    it('sorts by price ascending', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'price', sortOrder: 'asc' });
      const prices = items.map((i) => i.currentPrice);

      expect(prices).toEqual([180.0, 420.0, 450.0]);
    });

    it('sorts by price descending', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'price', sortOrder: 'desc' });
      const prices = items.map((i) => i.currentPrice);

      expect(prices).toEqual([450.0, 420.0, 180.0]);
    });

    it('sorts by percent change ascending', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'percentChange', sortOrder: 'asc' });
      const percents = items.map((i) => i.priceChangePercent);

      // MSFT is negative (-1.18%), VOO is +1.12%, AAPL is +2.86%
      expect(percents[0]).toBeLessThan(percents[1]);
      expect(percents[1]).toBeLessThan(percents[2]);
    });

    it('sorts by percent change descending', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist({ sortBy: 'percentChange', sortOrder: 'desc' });
      const percents = items.map((i) => i.priceChangePercent);

      // AAPL is +2.86%, VOO is +1.12%, MSFT is -1.18%
      expect(percents[0]).toBeGreaterThan(percents[1]);
      expect(percents[1]).toBeGreaterThan(percents[2]);
    });

    it('defaults to sorting by ticker ascending when no options provided', async () => {
      const service = await setupMultipleItems();

      const items = await service.getWatchlist();
      const tickers = items.map((i) => i.tickerSymbol);

      expect(tickers).toEqual(['AAPL', 'MSFT', 'VOO']);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Price change calculations (Requirement 12.3)
  // ──────────────────────────────────────────────────────────

  describe('price change calculations', () => {
    it('calculates positive price change correctly', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('VOO');

      // VOO: currentPrice=450, previousClose=445
      expect(item.priceChangeAmount).toBeCloseTo(5.0, 2);
      expect(item.priceChangePercent).toBeCloseTo((5.0 / 445.0) * 100, 2);
    });

    it('calculates negative price change correctly', async () => {
      const { watchlistService } = createService();

      const item = await watchlistService.addToWatchlist('MSFT');

      // MSFT: currentPrice=420, previousClose=425
      expect(item.priceChangeAmount).toBeCloseTo(-5.0, 2);
      expect(item.priceChangePercent).toBeCloseTo((-5.0 / 425.0) * 100, 2);
    });

    it('handles zero previousClose gracefully', async () => {
      const apiClient = createMockApiClient({
        fetchStockInfo: jest.fn().mockResolvedValue({
          ...sampleStockInfoVOO,
          previousClose: 0,
          currentPrice: 100,
        }),
      });
      const { watchlistService } = createService({ apiClient });

      const item = await watchlistService.addToWatchlist('VOO');

      expect(item.priceChangeAmount).toBe(100);
      expect(item.priceChangePercent).toBe(0); // avoid division by zero
    });
  });
});
