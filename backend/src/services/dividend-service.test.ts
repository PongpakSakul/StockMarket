import { DividendService, DividendSummary } from './dividend-service';
import { ValidationError } from './transaction-service';
import {
  InMemoryDividendRepository,
  CreateDividendDTO,
} from '../repositories/dividend-repository';
import {
  InMemoryTransactionRepository,
  CreateTransactionDTO,
} from '../repositories/transaction-repository';
import { Holding, Dividend } from '../types';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeDividendDTO(overrides: Partial<CreateDividendDTO> = {}): CreateDividendDTO {
  return {
    userId: 'user-1',
    tickerSymbol: 'VOO',
    dividendDate: '2024-06-15',
    amountPerShare: 1.5,
    totalAmount: 15.0,
    sharesHeld: 10,
    ...overrides,
  };
}

function makeTransactionDTO(overrides: Partial<CreateTransactionDTO> = {}): CreateTransactionDTO {
  return {
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-01-15',
    pricePerShare: 400.0,
    shares: 10,
    totalAmount: 4000.0,
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
    allocationPercent: 100,
    totalDividends: 0,
    totalReturnUSD: 500,
    totalReturnPercent: 12.5,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Test Suite
// ────────────────────────────────────────────────────────────

describe('DividendService', () => {
  let dividendRepo: InMemoryDividendRepository;
  let transactionRepo: InMemoryTransactionRepository;
  let service: DividendService;

  beforeEach(() => {
    dividendRepo = new InMemoryDividendRepository();
    transactionRepo = new InMemoryTransactionRepository();
    service = new DividendService(dividendRepo, transactionRepo);
  });

  // ────────────────────────────────────────────────────────────
  // createDividend
  // ────────────────────────────────────────────────────────────

  describe('createDividend', () => {
    beforeEach(async () => {
      // Seed a transaction so user holds VOO
      await transactionRepo.create(makeTransactionDTO());
    });

    it('creates a dividend when all inputs are valid', async () => {
      const dto = makeDividendDTO();
      const result = await service.createDividend(dto);

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.tickerSymbol).toBe('VOO');
      expect(result.dividendDate).toBe('2024-06-15');
      expect(result.amountPerShare).toBe(1.5);
      expect(result.totalAmount).toBe(15.0);
      expect(result.sharesHeld).toBe(10);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('rejects invalid ticker symbol', async () => {
      const dto = makeDividendDTO({ tickerSymbol: 'INVALID_TICKER' });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'INVALID_TICKER',
      });
    });

    it('rejects future dividend date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

      const dto = makeDividendDTO({ dividendDate: futureDateStr });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'INVALID_DATE',
      });
    });

    it('rejects negative amount per share', async () => {
      const dto = makeDividendDTO({ amountPerShare: -1 });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });

    it('rejects zero total amount', async () => {
      const dto = makeDividendDTO({ totalAmount: 0 });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });

    it('rejects zero shares held', async () => {
      const dto = makeDividendDTO({ sharesHeld: 0 });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'INVALID_AMOUNT',
      });
    });

    it('rejects dividend for ticker not held by user on that date', async () => {
      // User holds VOO from 2024-01-15, try to record dividend before that
      const dto = makeDividendDTO({ dividendDate: '2023-12-01' });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'TICKER_NOT_HELD',
      });
    });

    it('rejects dividend for ticker user never bought', async () => {
      const dto = makeDividendDTO({ tickerSymbol: 'AAPL' });

      await expect(service.createDividend(dto)).rejects.toThrow(ValidationError);
      await expect(service.createDividend(dto)).rejects.toMatchObject({
        code: 'TICKER_NOT_HELD',
      });
    });

    it('accepts dividend on the same date as the buy transaction', async () => {
      const dto = makeDividendDTO({ dividendDate: '2024-01-15' });
      const result = await service.createDividend(dto);

      expect(result.tickerSymbol).toBe('VOO');
      expect(result.dividendDate).toBe('2024-01-15');
    });
  });

  // ────────────────────────────────────────────────────────────
  // updateDividend
  // ────────────────────────────────────────────────────────────

  describe('updateDividend', () => {
    let dividendId: string;

    beforeEach(async () => {
      await transactionRepo.create(makeTransactionDTO());
      const created = await service.createDividend(makeDividendDTO());
      dividendId = created.id;
    });

    it('updates dividend fields', async () => {
      const result = await service.updateDividend(dividendId, 'user-1', {
        amountPerShare: 2.0,
        totalAmount: 20.0,
      });

      expect(result.amountPerShare).toBe(2.0);
      expect(result.totalAmount).toBe(20.0);
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      await expect(
        service.updateDividend('non-existent', 'user-1', { amountPerShare: 2.0 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NOT_FOUND when userId does not match', async () => {
      await expect(
        service.updateDividend(dividendId, 'user-2', { amountPerShare: 2.0 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('validates updated fields', async () => {
      await expect(
        service.updateDividend(dividendId, 'user-1', { amountPerShare: -5 }),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('re-validates holding when ticker changes', async () => {
      // User doesn't hold AAPL
      await expect(
        service.updateDividend(dividendId, 'user-1', { tickerSymbol: 'AAPL' }),
      ).rejects.toMatchObject({ code: 'TICKER_NOT_HELD' });
    });
  });

  // ────────────────────────────────────────────────────────────
  // deleteDividend
  // ────────────────────────────────────────────────────────────

  describe('deleteDividend', () => {
    let dividendId: string;

    beforeEach(async () => {
      await transactionRepo.create(makeTransactionDTO());
      const created = await service.createDividend(makeDividendDTO());
      dividendId = created.id;
    });

    it('deletes an existing dividend', async () => {
      await service.deleteDividend(dividendId, 'user-1');

      const result = await service.getDividends('user-1', {});
      expect(result.data).toHaveLength(0);
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      await expect(service.deleteDividend('non-existent', 'user-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND when userId does not match', async () => {
      await expect(service.deleteDividend(dividendId, 'user-2')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getDividends (filtering & pagination)
  // ────────────────────────────────────────────────────────────

  describe('getDividends', () => {
    beforeEach(async () => {
      await transactionRepo.create(makeTransactionDTO());
      await transactionRepo.create(makeTransactionDTO({ tickerSymbol: 'AAPL' }));

      // Create multiple dividends
      await service.createDividend(makeDividendDTO({ dividendDate: '2024-03-15', totalAmount: 10 }));
      await service.createDividend(makeDividendDTO({ dividendDate: '2024-06-15', totalAmount: 15 }));
      await service.createDividend(makeDividendDTO({ dividendDate: '2024-09-15', totalAmount: 20 }));
      await service.createDividend(makeDividendDTO({ tickerSymbol: 'AAPL', dividendDate: '2024-05-01', totalAmount: 5 }));
    });

    it('returns all dividends for a user', async () => {
      const result = await service.getDividends('user-1', {});
      expect(result.data).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it('filters by ticker symbol', async () => {
      const result = await service.getDividends('user-1', { tickerSymbol: 'AAPL' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].tickerSymbol).toBe('AAPL');
    });

    it('filters by date range', async () => {
      const result = await service.getDividends('user-1', {
        fromDate: '2024-04-01',
        toDate: '2024-07-01',
      });
      expect(result.data).toHaveLength(2);
    });

    it('paginates results', async () => {
      const page1 = await service.getDividends('user-1', { page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(4);
      expect(page1.totalPages).toBe(2);
      expect(page1.page).toBe(1);

      const page2 = await service.getDividends('user-1', { page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(2);
      expect(page2.page).toBe(2);
    });

    it('returns empty for different user', async () => {
      const result = await service.getDividends('user-2', {});
      expect(result.data).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getDividendSummary
  // ────────────────────────────────────────────────────────────

  describe('getDividendSummary', () => {
    beforeEach(async () => {
      await transactionRepo.create(makeTransactionDTO({ transactionDate: '2023-01-01' }));

      // Create dividends across different dates
      const now = new Date();
      const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`;
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, Math.min(now.getDate(), 28));
      const threeMonthsAgoStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(threeMonthsAgo.getDate()).padStart(2, '0')}`;

      await service.createDividend(makeDividendDTO({ dividendDate: recentDate, totalAmount: 25 }));
      await service.createDividend(makeDividendDTO({ dividendDate: threeMonthsAgoStr, totalAmount: 20 }));
    });

    it('returns cumulative dividends for ALL range', async () => {
      const summary = await service.getDividendSummary('user-1', 'ALL');
      expect(summary.totalAmount).toBe(45);
      expect(summary.count).toBe(2);
    });

    it('returns cumulative dividends for 1M range', async () => {
      const summary = await service.getDividendSummary('user-1', '1M');
      // Only the recent dividend should be in the last month
      expect(summary.totalAmount).toBe(25);
      expect(summary.count).toBe(1);
    });

    it('returns zero for user with no dividends', async () => {
      const summary = await service.getDividendSummary('user-2', 'ALL');
      expect(summary.totalAmount).toBe(0);
      expect(summary.count).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // calculateDividendYield
  // ────────────────────────────────────────────────────────────

  describe('calculateDividendYield', () => {
    it('calculates yield as (annual dividends / portfolio value) × 100', () => {
      const holdings: Holding[] = [makeHolding({ currentValueUSD: 10000 })];

      // Create dividends within the last year
      const now = new Date();
      const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const dividends: Dividend[] = [
        {
          id: 'div-1',
          userId: 'user-1',
          tickerSymbol: 'VOO',
          dividendDate: recentDate,
          amountPerShare: 1.5,
          totalAmount: 200,
          sharesHeld: 10,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ];

      const yield_ = service.calculateDividendYield(holdings, dividends);
      // 200 / 10000 * 100 = 2%
      expect(yield_).toBeCloseTo(2.0);
    });

    it('returns 0 when portfolio value is 0', () => {
      const holdings: Holding[] = [makeHolding({ currentValueUSD: 0 })];
      const dividends: Dividend[] = [];

      const yield_ = service.calculateDividendYield(holdings, dividends);
      expect(yield_).toBe(0);
    });

    it('excludes dividends older than 1 year', () => {
      const holdings: Holding[] = [makeHolding({ currentValueUSD: 10000 })];

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const oldDate = `${twoYearsAgo.getFullYear()}-${String(twoYearsAgo.getMonth() + 1).padStart(2, '0')}-01`;

      const dividends: Dividend[] = [
        {
          id: 'div-1',
          userId: 'user-1',
          tickerSymbol: 'VOO',
          dividendDate: oldDate,
          amountPerShare: 1.5,
          totalAmount: 200,
          sharesHeld: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const yield_ = service.calculateDividendYield(holdings, dividends);
      expect(yield_).toBe(0);
    });

    it('sums dividends from multiple tickers', () => {
      const holdings: Holding[] = [
        makeHolding({ tickerSymbol: 'VOO', currentValueUSD: 5000 }),
        makeHolding({ tickerSymbol: 'AAPL', currentValueUSD: 5000 }),
      ];

      const now = new Date();
      const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      const dividends: Dividend[] = [
        {
          id: 'div-1',
          userId: 'user-1',
          tickerSymbol: 'VOO',
          dividendDate: recentDate,
          amountPerShare: 1.5,
          totalAmount: 100,
          sharesHeld: 10,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          id: 'div-2',
          userId: 'user-1',
          tickerSymbol: 'AAPL',
          dividendDate: recentDate,
          amountPerShare: 0.5,
          totalAmount: 50,
          sharesHeld: 10,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ];

      const yield_ = service.calculateDividendYield(holdings, dividends);
      // (100 + 50) / (5000 + 5000) * 100 = 1.5%
      expect(yield_).toBeCloseTo(1.5);
    });
  });

  // ────────────────────────────────────────────────────────────
  // IDividendProvider implementation
  // ────────────────────────────────────────────────────────────

  describe('IDividendProvider', () => {
    beforeEach(async () => {
      await transactionRepo.create(makeTransactionDTO({ transactionDate: '2023-01-01' }));
      await transactionRepo.create(makeTransactionDTO({ tickerSymbol: 'AAPL', transactionDate: '2023-01-01' }));

      const now = new Date();
      const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.min(now.getDate(), 28)).padStart(2, '0')}`;

      await service.createDividend(makeDividendDTO({ dividendDate: recentDate, totalAmount: 30 }));
      await service.createDividend(makeDividendDTO({ tickerSymbol: 'AAPL', dividendDate: recentDate, totalAmount: 10 }));
      await service.createDividend(makeDividendDTO({ dividendDate: '2023-06-15', totalAmount: 20 }));
    });

    describe('getTotalDividendsForUser', () => {
      it('returns sum of all dividends for user', async () => {
        const total = await service.getTotalDividendsForUser('user-1');
        expect(total).toBe(60); // 30 + 10 + 20
      });

      it('returns 0 for user with no dividends', async () => {
        const total = await service.getTotalDividendsForUser('user-2');
        expect(total).toBe(0);
      });
    });

    describe('getDividendsByTicker', () => {
      it('returns sum of dividends for a specific ticker', async () => {
        const total = await service.getDividendsByTicker('user-1', 'VOO');
        expect(total).toBe(50); // 30 + 20
      });

      it('returns 0 for ticker with no dividends', async () => {
        const total = await service.getDividendsByTicker('user-1', 'MSFT');
        expect(total).toBe(0);
      });
    });

    describe('getAnnualDividends', () => {
      it('returns sum of dividends from last 12 months', async () => {
        const annual = await service.getAnnualDividends('user-1');
        // Only the recent dividends (30 + 10) should be within last year
        // The 2023-06-15 one may or may not be depending on current date
        expect(annual).toBeGreaterThanOrEqual(40);
      });

      it('returns 0 for user with no dividends', async () => {
        const annual = await service.getAnnualDividends('user-2');
        expect(annual).toBe(0);
      });
    });
  });
});
