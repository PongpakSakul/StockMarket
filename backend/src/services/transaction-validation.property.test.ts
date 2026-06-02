// Feature: stock-portfolio-tracker, Property 7: Transaction data validation
import * as fc from 'fast-check';
import {
  TransactionService,
  ValidationError,
  isValidTicker,
  isValidTransactionDate,
  isPositiveNumber,
} from './transaction-service';
import { InMemoryTransactionRepository, CreateTransactionDTO } from '../repositories/transaction-repository';
import { KNOWN_TICKER_LIST } from './slip-parser';

// ────────────────────────────────────────────────────────────
// Arbitraries
// ────────────────────────────────────────────────────────────

/** Arbitrary that produces a valid ticker from the known list */
const validTickerArb = fc.constantFrom(...KNOWN_TICKER_LIST);

/** Arbitrary that produces a valid past or today date string (YYYY-MM-DD) */
const validDateArb = fc.date({
  min: new Date('2000-01-01T00:00:00Z'),
  max: new Date(),
}).map((d) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

/** Arbitrary that produces a positive number (for price/shares) */
const positiveNumberArb = fc.double({ min: 0.001, max: 1_000_000, noNaN: true })
  .filter((n) => n > 0 && isFinite(n));

/** Arbitrary that produces a valid CreateTransactionDTO */
const validTransactionArb = fc.record({
  userId: fc.string({ minLength: 1, maxLength: 10 }),
  tickerSymbol: validTickerArb,
  transactionDate: validDateArb,
  pricePerShare: positiveNumberArb,
  shares: positiveNumberArb,
  totalAmount: positiveNumberArb,
});

/** Arbitrary that produces an invalid ticker (not in the known list) */
const invalidTickerArb = fc.stringOf(
  fc.constantFrom('X', 'Y', 'Z', 'W', '1', '2', '3'),
  { minLength: 1, maxLength: 6 },
).filter((s) => !KNOWN_TICKER_LIST.includes(s.toUpperCase()));

/** Arbitrary that produces a future date string (YYYY-MM-DD) */
const futureDateArb = fc.date({
  min: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  max: new Date('2099-12-31T00:00:00Z'),
}).map((d) => {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

/** Arbitrary that produces a negative number or zero */
const nonPositiveNumberArb = fc.oneof(
  fc.constant(0),
  fc.double({ min: -1_000_000, max: -0.001, noNaN: true }).filter((n) => n < 0 && isFinite(n)),
);

// ────────────────────────────────────────────────────────────
// Property-Based Tests
// ────────────────────────────────────────────────────────────

describe('Property 7: Transaction data validation', () => {
  let repo: InMemoryTransactionRepository;
  let service: TransactionService;

  beforeEach(() => {
    repo = new InMemoryTransactionRepository();
    service = new TransactionService(repo);
  });

  // ──────────────────────────────────────────────────────────
  // Valid transactions are accepted
  // ──────────────────────────────────────────────────────────

  it('accepts all valid transactions', async () => {
    await fc.assert(
      fc.asyncProperty(validTransactionArb, async (dto) => {
        const txn = await service.createTransaction(dto as CreateTransactionDTO);
        expect(txn).toBeDefined();
        expect(txn.id).toBeDefined();
        expect(txn.tickerSymbol).toBe(dto.tickerSymbol);
        expect(txn.transactionDate).toBe(dto.transactionDate);
        expect(txn.pricePerShare).toBe(dto.pricePerShare);
        expect(txn.shares).toBe(dto.shares);
      }),
      { numRuns: 100 },
    );
  });

  // ──────────────────────────────────────────────────────────
  // Invalid ticker is rejected
  // ──────────────────────────────────────────────────────────

  it('rejects transactions with invalid ticker symbols', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidTickerArb,
        validDateArb,
        positiveNumberArb,
        positiveNumberArb,
        positiveNumberArb,
        async (ticker, date, price, shares, total) => {
          const dto: CreateTransactionDTO = {
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: date,
            pricePerShare: price,
            shares,
            totalAmount: total,
          };

          try {
            await service.createTransaction(dto);
            // Should not reach here
            throw new Error('Expected ValidationError but transaction was accepted');
          } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).code).toBe('INVALID_TICKER');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ──────────────────────────────────────────────────────────
  // Future date is rejected
  // ──────────────────────────────────────────────────────────

  it('rejects transactions with future dates', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTickerArb,
        futureDateArb,
        positiveNumberArb,
        positiveNumberArb,
        positiveNumberArb,
        async (ticker, date, price, shares, total) => {
          const dto: CreateTransactionDTO = {
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: date,
            pricePerShare: price,
            shares,
            totalAmount: total,
          };

          try {
            await service.createTransaction(dto);
            throw new Error('Expected ValidationError but transaction was accepted');
          } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).code).toBe('INVALID_DATE');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ──────────────────────────────────────────────────────────
  // Negative or zero price is rejected
  // ──────────────────────────────────────────────────────────

  it('rejects transactions with non-positive price', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTickerArb,
        validDateArb,
        nonPositiveNumberArb,
        positiveNumberArb,
        positiveNumberArb,
        async (ticker, date, price, shares, total) => {
          const dto: CreateTransactionDTO = {
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: date,
            pricePerShare: price,
            shares,
            totalAmount: total,
          };

          try {
            await service.createTransaction(dto);
            throw new Error('Expected ValidationError but transaction was accepted');
          } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).code).toBe('INVALID_AMOUNT');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ──────────────────────────────────────────────────────────
  // Negative or zero shares is rejected
  // ──────────────────────────────────────────────────────────

  it('rejects transactions with non-positive shares', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTickerArb,
        validDateArb,
        positiveNumberArb,
        nonPositiveNumberArb,
        positiveNumberArb,
        async (ticker, date, price, shares, total) => {
          const dto: CreateTransactionDTO = {
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: date,
            pricePerShare: price,
            shares,
            totalAmount: total,
          };

          try {
            await service.createTransaction(dto);
            throw new Error('Expected ValidationError but transaction was accepted');
          } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).code).toBe('INVALID_AMOUNT');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ──────────────────────────────────────────────────────────
  // Validation helper properties
  // ──────────────────────────────────────────────────────────

  it('isValidTicker returns true for all known tickers', () => {
    fc.assert(
      fc.property(validTickerArb, (ticker) => {
        expect(isValidTicker(ticker)).toBe(true);
        // Also verify case-insensitivity
        expect(isValidTicker(ticker.toLowerCase())).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('isValidTransactionDate returns true for valid past/today dates', () => {
    fc.assert(
      fc.property(validDateArb, (date) => {
        expect(isValidTransactionDate(date)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('isValidTransactionDate returns false for future dates', () => {
    fc.assert(
      fc.property(futureDateArb, (date) => {
        expect(isValidTransactionDate(date)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('isPositiveNumber returns true for positive finite numbers', () => {
    fc.assert(
      fc.property(positiveNumberArb, (n) => {
        expect(isPositiveNumber(n)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('isPositiveNumber returns false for non-positive or non-finite numbers', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          nonPositiveNumberArb,
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
        ),
        (n) => {
          expect(isPositiveNumber(n)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
