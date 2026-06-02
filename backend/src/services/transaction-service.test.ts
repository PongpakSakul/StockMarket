import {
  TransactionService,
  ValidationError,
  isValidTicker,
  isValidTransactionDate,
  isPositiveNumber,
} from './transaction-service';
import {
  InMemoryTransactionRepository,
  CreateTransactionDTO,
} from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeDTO(overrides: Partial<CreateTransactionDTO> = {}): CreateTransactionDTO {
  return {
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-06-15',
    pricePerShare: 450.25,
    shares: 2.5,
    totalAmount: 1125.63,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Validation helpers (unit)
// ────────────────────────────────────────────────────────────

describe('Validation helpers', () => {
  describe('isValidTicker', () => {
    it('accepts known tickers', () => {
      expect(isValidTicker('VOO')).toBe(true);
      expect(isValidTicker('AAPL')).toBe(true);
      expect(isValidTicker('QQQM')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isValidTicker('voo')).toBe(true);
      expect(isValidTicker('aapl')).toBe(true);
    });

    it('rejects unknown tickers', () => {
      expect(isValidTicker('ZZZZZ')).toBe(false);
      expect(isValidTicker('')).toBe(false);
      expect(isValidTicker('FAKE')).toBe(false);
    });
  });

  describe('isValidTransactionDate', () => {
    it('accepts valid past dates', () => {
      expect(isValidTransactionDate('2024-01-15')).toBe(true);
      expect(isValidTransactionDate('2023-12-31')).toBe(true);
    });

    it('accepts today', () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(isValidTransactionDate(todayStr)).toBe(true);
    });

    it('rejects future dates', () => {
      expect(isValidTransactionDate('2099-01-01')).toBe(false);
    });

    it('rejects invalid format', () => {
      expect(isValidTransactionDate('01-15-2024')).toBe(false);
      expect(isValidTransactionDate('2024/01/15')).toBe(false);
      expect(isValidTransactionDate('not-a-date')).toBe(false);
    });

    it('rejects impossible calendar dates', () => {
      expect(isValidTransactionDate('2024-02-30')).toBe(false);
      expect(isValidTransactionDate('2024-13-01')).toBe(false);
      expect(isValidTransactionDate('2024-00-15')).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('accepts positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.001)).toBe(true);
      expect(isPositiveNumber(99999.99)).toBe(true);
    });

    it('rejects zero', () => {
      expect(isPositiveNumber(0)).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-0.01)).toBe(false);
    });

    it('rejects non-finite values', () => {
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber(Infinity)).toBe(false);
    });
  });
});


// ────────────────────────────────────────────────────────────
// TransactionService
// ────────────────────────────────────────────────────────────

describe('TransactionService', () => {
  let repo: InMemoryTransactionRepository;
  let service: TransactionService;

  beforeEach(() => {
    repo = new InMemoryTransactionRepository();
    service = new TransactionService(repo);
  });

  // ──────────────────────────────────────────────────────────
  // createTransaction (Requirements 6.1, 6.2)
  // ──────────────────────────────────────────────────────────

  describe('createTransaction', () => {
    it('creates a valid transaction', async () => {
      const dto = makeDTO();
      const txn = await service.createTransaction(dto);

      expect(txn.id).toBeDefined();
      expect(txn.tickerSymbol).toBe('VOO');
      expect(txn.transactionDate).toBe('2024-06-15');
      expect(txn.pricePerShare).toBe(450.25);
      expect(txn.shares).toBe(2.5);
      expect(txn.totalAmount).toBe(1125.63);
      expect(txn.source).toBe('manual');
    });

    it('rejects invalid ticker', async () => {
      await expect(
        service.createTransaction(makeDTO({ tickerSymbol: 'FAKE' })),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createTransaction(makeDTO({ tickerSymbol: 'FAKE' })),
      ).rejects.toMatchObject({ code: 'INVALID_TICKER' });
    });

    it('rejects future date', async () => {
      await expect(
        service.createTransaction(makeDTO({ transactionDate: '2099-12-31' })),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createTransaction(makeDTO({ transactionDate: '2099-12-31' })),
      ).rejects.toMatchObject({ code: 'INVALID_DATE' });
    });

    it('rejects invalid date format', async () => {
      await expect(
        service.createTransaction(makeDTO({ transactionDate: 'not-a-date' })),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects zero price', async () => {
      await expect(
        service.createTransaction(makeDTO({ pricePerShare: 0 })),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects negative price', async () => {
      await expect(
        service.createTransaction(makeDTO({ pricePerShare: -10 })),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects zero shares', async () => {
      await expect(
        service.createTransaction(makeDTO({ shares: 0 })),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects negative shares', async () => {
      await expect(
        service.createTransaction(makeDTO({ shares: -1 })),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects zero total amount', async () => {
      await expect(
        service.createTransaction(makeDTO({ totalAmount: 0 })),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('rejects NaN values', async () => {
      await expect(
        service.createTransaction(makeDTO({ pricePerShare: NaN })),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects Infinity values', async () => {
      await expect(
        service.createTransaction(makeDTO({ shares: Infinity })),
      ).rejects.toThrow(ValidationError);
    });

    it('preserves optional fields (source, slipImageUrl, ocrRawText)', async () => {
      const txn = await service.createTransaction(
        makeDTO({
          source: 'ocr',
          slipImageUrl: 'https://example.com/slip.jpg',
          ocrRawText: 'raw text',
        }),
      );

      expect(txn.source).toBe('ocr');
      expect(txn.slipImageUrl).toBe('https://example.com/slip.jpg');
      expect(txn.ocrRawText).toBe('raw text');
    });
  });

  // ──────────────────────────────────────────────────────────
  // updateTransaction (Requirement 6.3)
  // ──────────────────────────────────────────────────────────

  describe('updateTransaction', () => {
    it('updates specific fields', async () => {
      const created = await service.createTransaction(makeDTO());
      const updated = await service.updateTransaction(created.id, {
        pricePerShare: 460.00,
        shares: 3.0,
      });

      expect(updated.pricePerShare).toBe(460.00);
      expect(updated.shares).toBe(3.0);
      expect(updated.tickerSymbol).toBe('VOO'); // unchanged
    });

    it('validates merged fields on update', async () => {
      const created = await service.createTransaction(makeDTO());

      await expect(
        service.updateTransaction(created.id, { tickerSymbol: 'FAKE' }),
      ).rejects.toMatchObject({ code: 'INVALID_TICKER' });

      await expect(
        service.updateTransaction(created.id, { transactionDate: '2099-01-01' }),
      ).rejects.toMatchObject({ code: 'INVALID_DATE' });

      await expect(
        service.updateTransaction(created.id, { pricePerShare: -5 }),
      ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      await expect(
        service.updateTransaction('non-existent', { pricePerShare: 100 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // ──────────────────────────────────────────────────────────
  // deleteTransaction (Requirement 6.4)
  // ──────────────────────────────────────────────────────────

  describe('deleteTransaction', () => {
    it('deletes an existing transaction', async () => {
      const created = await service.createTransaction(makeDTO());
      await service.deleteTransaction(created.id);

      const result = await service.getTransactions({ page: 1, pageSize: 100 });
      expect(result.data).toHaveLength(0);
    });

    it('throws NOT_FOUND for non-existent id', async () => {
      await expect(
        service.deleteTransaction('non-existent'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // ──────────────────────────────────────────────────────────
  // getTransactions — filtering (Requirement 6.5)
  // ──────────────────────────────────────────────────────────

  describe('getTransactions — filtering', () => {
    beforeEach(async () => {
      await service.createTransaction(makeDTO({ tickerSymbol: 'VOO', transactionDate: '2024-01-10', totalAmount: 500 }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'AAPL', transactionDate: '2024-02-15', totalAmount: 300 }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'VOO', transactionDate: '2024-03-20', totalAmount: 700 }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'MSFT', transactionDate: '2024-04-25', totalAmount: 400 }));
    });

    it('filters by ticker symbol', async () => {
      const result = await service.getTransactions({ tickerSymbol: 'VOO' });
      expect(result.data).toHaveLength(2);
      expect(result.data.every((t) => t.tickerSymbol === 'VOO')).toBe(true);
    });

    it('filters by date range', async () => {
      const result = await service.getTransactions({
        fromDate: '2024-02-01',
        toDate: '2024-03-31',
      });
      expect(result.data).toHaveLength(2);
      expect(result.data.every((t) => t.transactionDate >= '2024-02-01' && t.transactionDate <= '2024-03-31')).toBe(true);
    });

    it('filters by ticker and date range combined', async () => {
      const result = await service.getTransactions({
        tickerSymbol: 'VOO',
        fromDate: '2024-03-01',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].transactionDate).toBe('2024-03-20');
    });

    it('returns empty when no matches', async () => {
      const result = await service.getTransactions({ tickerSymbol: 'TSLA' });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getTransactions — sorting (Requirement 6.6)
  // ──────────────────────────────────────────────────────────

  describe('getTransactions — sorting', () => {
    beforeEach(async () => {
      await service.createTransaction(makeDTO({ tickerSymbol: 'MSFT', transactionDate: '2024-03-01', totalAmount: 300 }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'AAPL', transactionDate: '2024-01-15', totalAmount: 500 }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'VOO', transactionDate: '2024-02-10', totalAmount: 100 }));
    });

    it('sorts by date ascending', async () => {
      const result = await service.getTransactions({ sortBy: 'date', sortOrder: 'asc' });
      const dates = result.data.map((t) => t.transactionDate);
      expect(dates).toEqual(['2024-01-15', '2024-02-10', '2024-03-01']);
    });

    it('sorts by date descending (default)', async () => {
      const result = await service.getTransactions({});
      const dates = result.data.map((t) => t.transactionDate);
      expect(dates).toEqual(['2024-03-01', '2024-02-10', '2024-01-15']);
    });

    it('sorts by ticker ascending', async () => {
      const result = await service.getTransactions({ sortBy: 'ticker', sortOrder: 'asc' });
      const tickers = result.data.map((t) => t.tickerSymbol);
      expect(tickers).toEqual(['AAPL', 'MSFT', 'VOO']);
    });

    it('sorts by amount descending', async () => {
      const result = await service.getTransactions({ sortBy: 'amount', sortOrder: 'desc' });
      const amounts = result.data.map((t) => t.totalAmount);
      expect(amounts).toEqual([500, 300, 100]);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getTransactions — pagination
  // ──────────────────────────────────────────────────────────

  describe('getTransactions — pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await service.createTransaction(
          makeDTO({ transactionDate: `2024-0${i}-01`, totalAmount: i * 100 }),
        );
      }
    });

    it('returns correct page size', async () => {
      const result = await service.getTransactions({ page: 1, pageSize: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it('returns correct second page', async () => {
      const result = await service.getTransactions({
        page: 2,
        pageSize: 2,
        sortBy: 'date',
        sortOrder: 'asc',
      });
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(2);
    });

    it('returns partial last page', async () => {
      const result = await service.getTransactions({
        page: 3,
        pageSize: 2,
        sortBy: 'date',
        sortOrder: 'asc',
      });
      expect(result.data).toHaveLength(1);
    });

    it('returns empty for page beyond range', async () => {
      const result = await service.getTransactions({ page: 10, pageSize: 2 });
      expect(result.data).toHaveLength(0);
    });
  });


  // ──────────────────────────────────────────────────────────
  // getBuyPointsForTicker (Requirement 2.5, Property 4)
  // ──────────────────────────────────────────────────────────

  describe('getBuyPointsForTicker', () => {
    it('returns empty array when no transactions exist', async () => {
      const points = await service.getBuyPointsForTicker('VOO');
      expect(points).toEqual([]);
    });

    it('returns one buy point per unique date', async () => {
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10', pricePerShare: 400, shares: 1, totalAmount: 400 }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-02-15', pricePerShare: 420, shares: 2, totalAmount: 840 }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-03-20', pricePerShare: 440, shares: 1.5, totalAmount: 660 }));

      const points = await service.getBuyPointsForTicker('VOO');

      expect(points).toHaveLength(3);
      expect(points.map((p) => p.date)).toEqual(['2024-01-10', '2024-02-15', '2024-03-20']);
      expect(points.every((p) => p.transactionCount === 1)).toBe(true);
    });

    it('aggregates multiple transactions on the same date', async () => {
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10', pricePerShare: 400, shares: 1, totalAmount: 400 }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10', pricePerShare: 410, shares: 2, totalAmount: 820 }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10', pricePerShare: 420, shares: 0.5, totalAmount: 210 }));

      const points = await service.getBuyPointsForTicker('VOO');

      expect(points).toHaveLength(1);
      const point = points[0];
      expect(point.date).toBe('2024-01-10');
      expect(point.transactionCount).toBe(3);
      expect(point.shares).toBeCloseTo(3.5, 6);
      expect(point.totalAmount).toBeCloseTo(1430, 2);
      // Weighted average: 1430 / 3.5 ≈ 408.57
      expect(point.pricePerShare).toBeCloseTo(1430 / 3.5, 2);
    });

    it('only includes transactions for the specified ticker', async () => {
      await service.createTransaction(makeDTO({ tickerSymbol: 'VOO', transactionDate: '2024-01-10' }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'AAPL', transactionDate: '2024-01-10' }));
      await service.createTransaction(makeDTO({ tickerSymbol: 'VOO', transactionDate: '2024-02-15' }));

      const points = await service.getBuyPointsForTicker('VOO');
      expect(points).toHaveLength(2);
    });

    it('returns buy points sorted by date ascending', async () => {
      await service.createTransaction(makeDTO({ transactionDate: '2024-03-20' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-02-15' }));

      const points = await service.getBuyPointsForTicker('VOO');
      const dates = points.map((p) => p.date);
      expect(dates).toEqual([...dates].sort());
    });

    it('marker count equals unique date count (Property 4)', async () => {
      // 5 transactions across 3 unique dates
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-01-10' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-02-15' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-02-15' }));
      await service.createTransaction(makeDTO({ transactionDate: '2024-03-20' }));

      const points = await service.getBuyPointsForTicker('VOO');
      expect(points).toHaveLength(3);

      // Verify transactionCount per date
      const jan = points.find((p) => p.date === '2024-01-10')!;
      const feb = points.find((p) => p.date === '2024-02-15')!;
      const mar = points.find((p) => p.date === '2024-03-20')!;
      expect(jan.transactionCount).toBe(2);
      expect(feb.transactionCount).toBe(2);
      expect(mar.transactionCount).toBe(1);

      // Total transactionCount should equal total transactions
      const totalCount = points.reduce((sum, p) => sum + p.transactionCount, 0);
      expect(totalCount).toBe(5);
    });
  });
});
