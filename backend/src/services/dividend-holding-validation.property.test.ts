// Feature: stock-portfolio-tracker, Property 15: Dividend rejected if ticker not held on date

import fc from 'fast-check';
import { DividendService } from './dividend-service';
import { ValidationError } from './transaction-service';
import { InMemoryDividendRepository } from '../repositories/dividend-repository';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';
import { KNOWN_TICKER_LIST } from './slip-parser';

// ────────────────────────────────────────────────────────────
// Arbitraries
// ────────────────────────────────────────────────────────────

/** Pick a random valid ticker from the known list */
const validTickerArb = fc.constantFrom(...KNOWN_TICKER_LIST);

/**
 * Generate a ticker string that is NOT in the known list.
 * Uses characters unlikely to match real tickers.
 */
const invalidTickerArb = fc.stringOf(
  fc.constantFrom('X', 'Z', 'Q', 'W', '9', '8', '7'),
  { minLength: 1, maxLength: 6 },
).filter((s) => !KNOWN_TICKER_LIST.includes(s.toUpperCase()));

/** Generate a valid past date string (YYYY-MM-DD) between 2020 and 2024 */
const pastDateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2024 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
);

/** Generate a positive monetary amount (0.01 to 10000) */
const positiveAmountArb = fc.integer({ min: 1, max: 1000000 }).map((n) => n / 100);

/** Generate a positive shares count (0.000001 to 1000) */
const positiveSharesArb = fc.integer({ min: 1, max: 1000000 }).map((n) => n / 1000);

// ────────────────────────────────────────────────────────────
// Property Tests
// ────────────────────────────────────────────────────────────

describe('Dividend Holding Validation (Property-Based)', () => {
  let dividendRepo: InMemoryDividendRepository;
  let transactionRepo: InMemoryTransactionRepository;
  let service: DividendService;

  beforeEach(() => {
    dividendRepo = new InMemoryDividendRepository();
    transactionRepo = new InMemoryTransactionRepository();
    service = new DividendService(dividendRepo, transactionRepo);
  });

  it('rejects dividend when ticker is not held by user on the dividend date', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Ticker the user actually holds
        validTickerArb,
        // A different ticker not held by the user (also valid for ticker validation)
        validTickerArb,
        // Purchase date for the held ticker
        pastDateArb,
        // Dividend date
        pastDateArb,
        // Dividend amounts
        positiveAmountArb,
        positiveSharesArb,
        async (heldTicker, dividendTicker, purchaseDate, dividendDate, amount, shares) => {
          // Ensure the dividend ticker is different from the held ticker
          if (heldTicker === dividendTicker) return; // skip this case

          // Seed a transaction so the user holds `heldTicker`
          await transactionRepo.create({
            userId: 'user-1',
            tickerSymbol: heldTicker,
            transactionDate: purchaseDate,
            pricePerShare: 100,
            shares: 10,
            totalAmount: 1000,
          });

          // Attempt to create a dividend for a ticker the user does NOT hold
          try {
            await service.createDividend({
              userId: 'user-1',
              tickerSymbol: dividendTicker,
              dividendDate: dividendDate,
              amountPerShare: amount,
              totalAmount: amount * shares,
              sharesHeld: shares,
            });
            // If we get here, the dividend was accepted — this should not happen
            throw new Error(
              `Dividend for non-held ticker "${dividendTicker}" was accepted but should have been rejected`,
            );
          } catch (err) {
            if (err instanceof ValidationError) {
              expect(err.code).toBe('TICKER_NOT_HELD');
            } else {
              throw err;
            }
          }

          // Clean up for next iteration
          transactionRepo.clear();
          dividendRepo.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts dividend when ticker is held by user on or before the dividend date', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Ticker the user holds
        validTickerArb,
        // Purchase date
        pastDateArb,
        // Days after purchase for the dividend (0 to 365)
        fc.integer({ min: 0, max: 365 }),
        // Dividend amounts
        positiveAmountArb,
        positiveSharesArb,
        async (ticker, purchaseDate, daysAfter, amount, shares) => {
          // Compute a dividend date that is on or after the purchase date
          const purchaseDateObj = new Date(purchaseDate);
          const dividendDateObj = new Date(purchaseDateObj.getTime() + daysAfter * 24 * 60 * 60 * 1000);

          // Ensure dividend date is not in the future
          const now = new Date();
          if (dividendDateObj > now) return; // skip future dates

          const dividendDate = `${dividendDateObj.getFullYear()}-${String(dividendDateObj.getMonth() + 1).padStart(2, '0')}-${String(dividendDateObj.getDate()).padStart(2, '0')}`;

          // Seed a transaction so the user holds this ticker from purchaseDate
          await transactionRepo.create({
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: purchaseDate,
            pricePerShare: 100,
            shares: 10,
            totalAmount: 1000,
          });

          // Create dividend — should succeed
          const result = await service.createDividend({
            userId: 'user-1',
            tickerSymbol: ticker,
            dividendDate: dividendDate,
            amountPerShare: amount,
            totalAmount: amount * shares,
            sharesHeld: shares,
          });

          expect(result).toBeDefined();
          expect(result.tickerSymbol).toBe(ticker);
          expect(result.dividendDate).toBe(dividendDate);

          // Clean up for next iteration
          transactionRepo.clear();
          dividendRepo.clear();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects dividend when ticker is held but only AFTER the dividend date', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Ticker the user holds
        validTickerArb,
        // Purchase date (later date)
        pastDateArb,
        // Days before purchase for the dividend (1 to 365)
        fc.integer({ min: 1, max: 365 }),
        // Dividend amounts
        positiveAmountArb,
        positiveSharesArb,
        async (ticker, purchaseDate, daysBefore, amount, shares) => {
          // Compute a dividend date that is BEFORE the purchase date
          const purchaseDateObj = new Date(purchaseDate);
          const dividendDateObj = new Date(purchaseDateObj.getTime() - daysBefore * 24 * 60 * 60 * 1000);

          const dividendDate = `${dividendDateObj.getFullYear()}-${String(dividendDateObj.getMonth() + 1).padStart(2, '0')}-${String(dividendDateObj.getDate()).padStart(2, '0')}`;

          // Ensure dividend date is still valid (not in the future, after 2000)
          if (dividendDateObj.getFullYear() < 2000) return;
          const now = new Date();
          if (dividendDateObj > now) return;

          // Seed a transaction so the user holds ticker from purchaseDate (AFTER dividend date)
          await transactionRepo.create({
            userId: 'user-1',
            tickerSymbol: ticker,
            transactionDate: purchaseDate,
            pricePerShare: 100,
            shares: 10,
            totalAmount: 1000,
          });

          // Attempt to create dividend before purchase — should be rejected
          try {
            await service.createDividend({
              userId: 'user-1',
              tickerSymbol: ticker,
              dividendDate: dividendDate,
              amountPerShare: amount,
              totalAmount: amount * shares,
              sharesHeld: shares,
            });
            throw new Error(
              `Dividend for ticker "${ticker}" on ${dividendDate} was accepted but user only purchased on ${purchaseDate}`,
            );
          } catch (err) {
            if (err instanceof ValidationError) {
              expect(err.code).toBe('TICKER_NOT_HELD');
            } else {
              throw err;
            }
          }

          // Clean up for next iteration
          transactionRepo.clear();
          dividendRepo.clear();
        },
      ),
      { numRuns: 100 },
    );
  });
});
