import {
  PortfolioService,
  ITransactionProvider,
  IPriceProvider,
  IExchangeRateProvider,
  IDividendProvider,
} from './portfolio-service';
import { Transaction, Holding, ExchangeRate, TimeRange } from '../types';

// ────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-01-15',
    pricePerShare: 400,
    shares: 2,
    totalAmount: 800,
    source: 'manual',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    tickerSymbol: 'VOO',
    tickerName: 'Vanguard S&P 500 ETF',
    totalShares: 10,
    averageCostBasis: 400,
    currentPrice: 450,
    currentValueUSD: 4500,
    unrealizedPLUSD: 500,
    unrealizedPLPercent: 12.5,
    allocationPercent: 50,
    totalDividends: 100,
    totalReturnUSD: 600,
    totalReturnPercent: 15,
    ...overrides,
  };
}

function createMockProviders(overrides: {
  transactions?: Transaction[];
  prices?: Map<string, number>;
  exchangeRate?: ExchangeRate;
  totalDividends?: number;
  annualDividends?: number;
  dividendsByTicker?: Map<string, number>;
  tickerNames?: Map<string, string>;
  historicalPrices?: Map<string, Map<string, number>>;
} = {}) {
  const transactions = overrides.transactions ?? [];
  const prices = overrides.prices ?? new Map();
  const exchangeRate: ExchangeRate = overrides.exchangeRate ?? {
    currencyPair: 'USD_THB',
    rate: 35.5,
    fetchedAt: '2024-06-01T00:00:00Z',
    isStale: false,
  };
  const totalDividends = overrides.totalDividends ?? 0;
  const annualDividends = overrides.annualDividends ?? 0;
  const dividendsByTicker = overrides.dividendsByTicker ?? new Map();
  const tickerNames = overrides.tickerNames ?? new Map([
    ['VOO', 'Vanguard S&P 500 ETF'],
    ['AAPL', 'Apple Inc.'],
    ['MSFT', 'Microsoft Corp.'],
    ['QQQM', 'Invesco NASDAQ 100 ETF'],
  ]);
  const historicalPrices = overrides.historicalPrices ?? new Map();

  const transactionProvider: ITransactionProvider = {
    getTransactionsForUser: jest.fn().mockResolvedValue(transactions),
    getTransactionsByTicker: jest.fn().mockImplementation((_userId: string, ticker: string) =>
      Promise.resolve(transactions.filter((t) => t.tickerSymbol === ticker)),
    ),
  };

  const priceProvider: IPriceProvider = {
    getCurrentPrices: jest.fn().mockResolvedValue(prices),
    getTickerName: jest.fn().mockImplementation((ticker: string) =>
      Promise.resolve(tickerNames.get(ticker) ?? ticker),
    ),
    getHistoricalPrices: jest.fn().mockImplementation((ticker: string) =>
      Promise.resolve(historicalPrices.get(ticker) ?? new Map()),
    ),
  };

  const exchangeRateProvider: IExchangeRateProvider = {
    getCurrentRate: jest.fn().mockResolvedValue(exchangeRate),
  };

  const dividendProvider: IDividendProvider = {
    getTotalDividendsForUser: jest.fn().mockResolvedValue(totalDividends),
    getDividendsByTicker: jest.fn().mockImplementation((_userId: string, ticker: string) =>
      Promise.resolve(dividendsByTicker.get(ticker) ?? 0),
    ),
    getAnnualDividends: jest.fn().mockResolvedValue(annualDividends),
  };

  return { transactionProvider, priceProvider, exchangeRateProvider, dividendProvider };
}

// ────────────────────────────────────────────────────────────
// calculateAverageCostBasis (Requirements 2.4, 5.2)
// ────────────────────────────────────────────────────────────

describe('PortfolioService', () => {
  describe('calculateAverageCostBasis', () => {
    let service: PortfolioService;

    beforeEach(() => {
      const providers = createMockProviders();
      service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );
    });

    it('returns 0 for empty transactions', () => {
      expect(service.calculateAverageCostBasis([])).toBe(0);
    });

    it('returns price per share for a single transaction', () => {
      const transactions = [makeTransaction({ shares: 5, totalAmount: 2000 })];
      expect(service.calculateAverageCostBasis(transactions)).toBe(400);
    });

    it('calculates weighted average for multiple transactions', () => {
      const transactions = [
        makeTransaction({ shares: 2, totalAmount: 800 }),   // $400/share
        makeTransaction({ shares: 3, totalAmount: 1350 }),  // $450/share
      ];
      // (800 + 1350) / (2 + 3) = 2150 / 5 = 430
      expect(service.calculateAverageCostBasis(transactions)).toBe(430);
    });

    it('handles fractional shares correctly', () => {
      const transactions = [
        makeTransaction({ shares: 1.5, totalAmount: 675 }),   // $450/share
        makeTransaction({ shares: 2.5, totalAmount: 1000 }),  // $400/share
      ];
      // (675 + 1000) / (1.5 + 2.5) = 1675 / 4 = 418.75
      expect(service.calculateAverageCostBasis(transactions)).toBe(418.75);
    });

    it('handles many transactions', () => {
      const transactions = [
        makeTransaction({ shares: 1, totalAmount: 100 }),
        makeTransaction({ shares: 2, totalAmount: 300 }),
        makeTransaction({ shares: 3, totalAmount: 600 }),
        makeTransaction({ shares: 4, totalAmount: 1000 }),
      ];
      // (100 + 300 + 600 + 1000) / (1 + 2 + 3 + 4) = 2000 / 10 = 200
      expect(service.calculateAverageCostBasis(transactions)).toBe(200);
    });

    it('returns 0 when total shares is 0', () => {
      const transactions = [makeTransaction({ shares: 0, totalAmount: 0 })];
      expect(service.calculateAverageCostBasis(transactions)).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // calculateUnrealizedPL (Requirements 5.1, 5.3)
  // ────────────────────────────────────────────────────────────

  describe('calculateUnrealizedPL', () => {
    let service: PortfolioService;

    beforeEach(() => {
      const providers = createMockProviders();
      service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );
    });

    it('returns empty array for empty holdings', () => {
      expect(service.calculateUnrealizedPL([], new Map())).toEqual([]);
    });

    it('calculates positive P/L when price is above cost', () => {
      const holdings = [makeHolding({ tickerSymbol: 'VOO', averageCostBasis: 400, totalShares: 10 })];
      const prices = new Map([['VOO', 450]]);

      const result = service.calculateUnrealizedPL(holdings, prices);

      expect(result).toHaveLength(1);
      expect(result[0].tickerSymbol).toBe('VOO');
      // (450 - 400) × 10 = 500
      expect(result[0].unrealizedPLUSD).toBe(500);
      // 500 / (400 × 10) × 100 = 12.5%
      expect(result[0].unrealizedPLPercent).toBe(12.5);
    });

    it('calculates negative P/L when price is below cost', () => {
      const holdings = [makeHolding({ tickerSymbol: 'AAPL', averageCostBasis: 200, totalShares: 5 })];
      const prices = new Map([['AAPL', 180]]);

      const result = service.calculateUnrealizedPL(holdings, prices);

      expect(result).toHaveLength(1);
      // (180 - 200) × 5 = -100
      expect(result[0].unrealizedPLUSD).toBe(-100);
      // -100 / (200 × 5) × 100 = -10%
      expect(result[0].unrealizedPLPercent).toBe(-10);
    });

    it('calculates zero P/L when price equals cost', () => {
      const holdings = [makeHolding({ tickerSymbol: 'VOO', averageCostBasis: 400, totalShares: 10 })];
      const prices = new Map([['VOO', 400]]);

      const result = service.calculateUnrealizedPL(holdings, prices);

      expect(result[0].unrealizedPLUSD).toBe(0);
      expect(result[0].unrealizedPLPercent).toBe(0);
    });

    it('handles multiple holdings', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', averageCostBasis: 400, totalShares: 10 }),
        makeHolding({ tickerSymbol: 'AAPL', averageCostBasis: 150, totalShares: 20 }),
      ];
      const prices = new Map([['VOO', 450], ['AAPL', 160]]);

      const result = service.calculateUnrealizedPL(holdings, prices);

      expect(result).toHaveLength(2);
      // VOO: (450 - 400) × 10 = 500
      expect(result[0].unrealizedPLUSD).toBe(500);
      // AAPL: (160 - 150) × 20 = 200
      expect(result[1].unrealizedPLUSD).toBe(200);
    });

    it('uses holding currentPrice as fallback when price not in map', () => {
      const holdings = [makeHolding({ tickerSymbol: 'VOO', averageCostBasis: 400, totalShares: 10, currentPrice: 420 })];
      const prices = new Map<string, number>(); // empty map

      const result = service.calculateUnrealizedPL(holdings, prices);

      // (420 - 400) × 10 = 200
      expect(result[0].unrealizedPLUSD).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────
  // calculateAllocation (Requirement 5.4)
  // ────────────────────────────────────────────────────────────

  describe('calculateAllocation', () => {
    let service: PortfolioService;

    beforeEach(() => {
      const providers = createMockProviders();
      service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );
    });

    it('returns empty array for empty holdings', () => {
      expect(service.calculateAllocation([])).toEqual([]);
    });

    it('returns 100% for a single holding', () => {
      const holdings = [makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 5000 })];
      const result = service.calculateAllocation(holdings);

      expect(result).toHaveLength(1);
      expect(result[0].percentage).toBe(100);
      expect(result[0].tickerSymbol).toBe('VOO');
    });

    it('calculates correct percentages for two holdings', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', tickerName: 'Vanguard S&P 500 ETF', currentValueUSD: 6000 }),
        makeHolding({ tickerSymbol: 'AAPL', tickerName: 'Apple Inc.', currentValueUSD: 4000 }),
      ];
      const result = service.calculateAllocation(holdings);

      expect(result).toHaveLength(2);
      const voo = result.find((a) => a.tickerSymbol === 'VOO')!;
      const aapl = result.find((a) => a.tickerSymbol === 'AAPL')!;
      expect(voo.percentage).toBeCloseTo(60, 1);
      expect(aapl.percentage).toBeCloseTo(40, 1);
    });

    it('percentages sum to 100%', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 3333 }),
        makeHolding({ tickerSymbol: 'AAPL', currentValueUSD: 3333 }),
        makeHolding({ tickerSymbol: 'MSFT', currentValueUSD: 3334 }),
      ];
      const result = service.calculateAllocation(holdings);

      const sum = result.reduce((s, a) => s + a.percentage, 0);
      expect(sum).toBeCloseTo(100, 1);
    });

    it('handles uneven splits that require rounding', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 1000 }),
        makeHolding({ tickerSymbol: 'AAPL', currentValueUSD: 1000 }),
        makeHolding({ tickerSymbol: 'MSFT', currentValueUSD: 1000 }),
      ];
      const result = service.calculateAllocation(holdings);

      const sum = result.reduce((s, a) => s + a.percentage, 0);
      // Must sum to 100% within tolerance
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
    });

    it('handles many holdings with allocation summing to 100%', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 1500 }),
        makeHolding({ tickerSymbol: 'AAPL', currentValueUSD: 2300 }),
        makeHolding({ tickerSymbol: 'MSFT', currentValueUSD: 1700 }),
        makeHolding({ tickerSymbol: 'QQQM', currentValueUSD: 4500 }),
      ];
      const result = service.calculateAllocation(holdings);

      const sum = result.reduce((s, a) => s + a.percentage, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
    });

    it('returns empty for holdings with zero total value', () => {
      const holdings = [
        makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 0 }),
        makeHolding({ tickerSymbol: 'AAPL', currentValueUSD: 0 }),
      ];
      const result = service.calculateAllocation(holdings);
      expect(result).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getSummary (Requirements 5.1, 5.2, 5.3, 5.5, 5.6)
  // ────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns zero values for user with no transactions', async () => {
      const providers = createMockProviders({ transactions: [] });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const summary = await service.getSummary('user-1');

      expect(summary.totalValueUSD).toBe(0);
      expect(summary.totalValueTHB).toBe(0);
      expect(summary.totalCostBasis).toBe(0);
      expect(summary.unrealizedPLUSD).toBe(0);
      expect(summary.unrealizedPLPercent).toBe(0);
      expect(summary.holdings).toHaveLength(0);
    });

    it('calculates correct summary for single holding', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', shares: 10, totalAmount: 4000 }),
      ];
      const prices = new Map([['VOO', 450]]);
      const exchangeRate: ExchangeRate = {
        currencyPair: 'USD_THB',
        rate: 35.0,
        fetchedAt: '2024-06-01T00:00:00Z',
        isStale: false,
      };

      const providers = createMockProviders({
        transactions,
        prices,
        exchangeRate,
        totalDividends: 50,
        annualDividends: 50,
        dividendsByTicker: new Map([['VOO', 50]]),
      });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const summary = await service.getSummary('user-1');

      // Total value: 10 × 450 = 4500
      expect(summary.totalValueUSD).toBe(4500);
      expect(summary.totalValueTHB).toBe(4500 * 35.0);
      // Cost basis: 4000
      expect(summary.totalCostBasis).toBe(4000);
      // Unrealized P/L: 4500 - 4000 = 500
      expect(summary.unrealizedPLUSD).toBe(500);
      expect(summary.unrealizedPLTHB).toBe(500 * 35.0);
      // Unrealized P/L %: (500 / 4000) × 100 = 12.5%
      expect(summary.unrealizedPLPercent).toBe(12.5);
      // Total return: 500 + 50 = 550
      expect(summary.totalReturnUSD).toBe(550);
      // Total return %: (550 / 4000) × 100 = 13.75%
      expect(summary.totalReturnPercent).toBeCloseTo(13.75, 2);
      // Dividend yield: (50 / 4500) × 100 ≈ 1.11%
      expect(summary.dividendYieldPercent).toBeCloseTo(1.111, 2);
      expect(summary.holdings).toHaveLength(1);
      expect(summary.exchangeRate.rate).toBe(35.0);
    });

    it('calculates correct summary for multiple holdings', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', shares: 5, totalAmount: 2000 }),
        makeTransaction({ tickerSymbol: 'VOO', shares: 5, totalAmount: 2500 }),
        makeTransaction({ tickerSymbol: 'AAPL', shares: 10, totalAmount: 1500 }),
      ];
      const prices = new Map([['VOO', 500], ['AAPL', 180]]);

      const providers = createMockProviders({
        transactions,
        prices,
        totalDividends: 100,
        annualDividends: 100,
        dividendsByTicker: new Map([['VOO', 60], ['AAPL', 40]]),
      });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const summary = await service.getSummary('user-1');

      // VOO: 10 shares × $500 = $5000, cost = $4500, avgCost = $450
      // AAPL: 10 shares × $180 = $1800, cost = $1500, avgCost = $150
      expect(summary.totalValueUSD).toBe(6800);
      expect(summary.totalCostBasis).toBe(6000);
      expect(summary.unrealizedPLUSD).toBe(800);
      expect(summary.holdings).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getAllocation (Requirement 5.4)
  // ────────────────────────────────────────────────────────────

  describe('getAllocation', () => {
    it('returns empty for user with no transactions', async () => {
      const providers = createMockProviders({ transactions: [] });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const allocation = await service.getAllocation('user-1');
      expect(allocation).toEqual([]);
    });

    it('returns correct allocation for multiple tickers', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', shares: 10, totalAmount: 4000 }),
        makeTransaction({ tickerSymbol: 'AAPL', shares: 20, totalAmount: 3000 }),
      ];
      const prices = new Map([['VOO', 500], ['AAPL', 200]]);

      const providers = createMockProviders({ transactions, prices });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const allocation = await service.getAllocation('user-1');

      // VOO: 10 × 500 = 5000, AAPL: 20 × 200 = 4000, total = 9000
      expect(allocation).toHaveLength(2);
      const voo = allocation.find((a) => a.tickerSymbol === 'VOO')!;
      const aapl = allocation.find((a) => a.tickerSymbol === 'AAPL')!;
      expect(voo.valueUSD).toBe(5000);
      expect(aapl.valueUSD).toBe(4000);

      const sum = allocation.reduce((s, a) => s + a.percentage, 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getPerformance (Requirement 5.5)
  // ────────────────────────────────────────────────────────────

  describe('getPerformance', () => {
    it('returns empty data points when no historical prices available', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', shares: 10, totalAmount: 4000 }),
      ];

      const providers = createMockProviders({
        transactions,
        historicalPrices: new Map([
          ['SPY', new Map()],
          ['VOO', new Map()],
        ]),
      });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const performance = await service.getPerformance('user-1', '1M', 'SPY');

      expect(performance.range).toBe('1M');
      expect(performance.benchmark).toBe('SPY');
      expect(performance.dataPoints).toHaveLength(0);
      expect(performance.portfolioTotalReturn).toBe(0);
      expect(performance.benchmarkTotalReturn).toBe(0);
    });

    it('calculates portfolio vs benchmark returns', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', shares: 10, totalAmount: 4000 }),
      ];

      const benchmarkPrices = new Map([
        ['2024-01-01', 100],
        ['2024-01-15', 105],
        ['2024-02-01', 110],
      ]);
      const vooPrices = new Map([
        ['2024-01-01', 400],
        ['2024-01-15', 420],
        ['2024-02-01', 450],
      ]);

      const providers = createMockProviders({
        transactions,
        historicalPrices: new Map([
          ['SPY', benchmarkPrices],
          ['VOO', vooPrices],
        ]),
      });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const performance = await service.getPerformance('user-1', '1M', 'SPY');

      expect(performance.dataPoints).toHaveLength(3);

      // Day 1: portfolio value = 10 × 400 = 4000, cost = 4000, return = 0%
      expect(performance.dataPoints[0].portfolioReturn).toBe(0);
      expect(performance.dataPoints[0].benchmarkReturn).toBe(0);

      // Day 2: portfolio value = 10 × 420 = 4200, return = (4200-4000)/4000 × 100 = 5%
      expect(performance.dataPoints[1].portfolioReturn).toBe(5);
      // Benchmark: (105-100)/100 × 100 = 5%
      expect(performance.dataPoints[1].benchmarkReturn).toBe(5);

      // Day 3: portfolio value = 10 × 450 = 4500, return = (4500-4000)/4000 × 100 = 12.5%
      expect(performance.dataPoints[2].portfolioReturn).toBe(12.5);
      // Benchmark: (110-100)/100 × 100 = 10%
      expect(performance.dataPoints[2].benchmarkReturn).toBe(10);

      expect(performance.portfolioTotalReturn).toBe(12.5);
      expect(performance.benchmarkTotalReturn).toBe(10);
    });

    it('handles user with no transactions', async () => {
      const providers = createMockProviders({
        transactions: [],
        historicalPrices: new Map([['SPY', new Map([['2024-01-01', 100]])]]),
      });
      const service = new PortfolioService(
        providers.transactionProvider,
        providers.priceProvider,
        providers.exchangeRateProvider,
        providers.dividendProvider,
      );

      const performance = await service.getPerformance('user-1', '1M', 'SPY');

      // No holdings, so portfolio return is 0
      expect(performance.dataPoints[0].portfolioReturn).toBe(0);
    });
  });
});
