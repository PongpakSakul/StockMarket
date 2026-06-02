// Feature: stock-portfolio-tracker, Property 8: Filtering returns only matching records

import * as fc from 'fast-check';
import { Transaction, TransactionFilters } from '../types';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';
import { TransactionService } from './transaction-service';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Pool of ticker symbols for generating realistic data */
const TICKER_POOL = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'VOO', 'QQQ', 'SPY', 'VTI'];

/** Generate a valid ISO date string (YYYY-MM-DD) within a reasonable range */
const arbDate = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2024-12-31'),
}).map((d) => d.toISOString().slice(0, 10));

/** Generate a ticker symbol from the pool */
const arbTicker = fc.constantFrom(...TICKER_POOL);

/** Generate a single transaction record */
const arbTransaction = fc.record({
  tickerSymbol: arbTicker,
  transactionDate: arbDate,
  pricePerShare: fc.double({ min: 1, max: 1000, noNaN: true }),
  shares: fc.double({ min: 0.001, max: 10000, noNaN: true }),
  totalAmount: fc.double({ min: 1, max: 10_000_000, noNaN: true }),
});

/** Generate a list of transactions (1 to 50) */
const arbTransactions = fc.array(arbTransaction, { minLength: 1, maxLength: 50 });

/** Generate optional filter criteria */
const arbFilters = fc.record({
  tickerSymbol: fc.option(arbTicker, { nil: undefined }),
  fromDate: fc.option(arbDate, { nil: undefined }),
  toDate: fc.option(arbDate, { nil: undefined }),
});

// ────────────────────────────────────────────────────────────
// Helper: check if a transaction matches given filter criteria
// ────────────────────────────────────────────────────────────

function matchesFilter(txn: Transaction, filters: TransactionFilters): boolean {
  if (filters.tickerSymbol && txn.tickerSymbol !== filters.tickerSymbol) {
    return false;
  }
  if (filters.fromDate && txn.transactionDate < filters.fromDate) {
    return false;
  }
  if (filters.toDate && txn.transactionDate > filters.toDate) {
    return false;
  }
  return true;
}

// ────────────────────────────────────────────────────────────
// Property-Based Tests
// ────────────────────────────────────────────────────────────

describe('Property 8: Filtering returns only matching records', () => {
  let repository: InMemoryTransactionRepository;
  let service: TransactionService;

  beforeEach(() => {
    repository = new InMemoryTransactionRepository();
    service = new TransactionService(repository);
  });

  it('all returned results match all applied filter criteria', async () => {
    await fc.assert(
      fc.asyncProperty(arbTransactions, arbFilters, async (txnInputs, filters) => {
        // Setup: clear and populate repository
        repository.clear();
        for (const input of txnInputs) {
          await repository.create({
            userId: 'user-1',
            ...input,
          });
        }

        // Normalize filters: ensure fromDate <= toDate when both present
        const normalizedFilters: TransactionFilters = {
          tickerSymbol: filters.tickerSymbol,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          page: 1,
          pageSize: 1000, // large enough to get all results
        };

        if (normalizedFilters.fromDate && normalizedFilters.toDate) {
          if (normalizedFilters.fromDate > normalizedFilters.toDate) {
            // Swap to ensure valid range
            const temp = normalizedFilters.fromDate;
            normalizedFilters.fromDate = normalizedFilters.toDate;
            normalizedFilters.toDate = temp;
          }
        }

        // Act: apply filter
        const result = await service.getTransactions(normalizedFilters);

        // Assert: every returned record matches ALL filter criteria
        for (const txn of result.data) {
          if (normalizedFilters.tickerSymbol) {
            expect(txn.tickerSymbol).toBe(normalizedFilters.tickerSymbol);
          }
          if (normalizedFilters.fromDate) {
            expect(txn.transactionDate >= normalizedFilters.fromDate).toBe(true);
          }
          if (normalizedFilters.toDate) {
            expect(txn.transactionDate <= normalizedFilters.toDate).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('no matching records are excluded from results (completeness)', async () => {
    await fc.assert(
      fc.asyncProperty(arbTransactions, arbFilters, async (txnInputs, filters) => {
        // Setup: clear and populate repository
        repository.clear();
        for (const input of txnInputs) {
          await repository.create({
            userId: 'user-1',
            ...input,
          });
        }

        // Normalize filters: ensure fromDate <= toDate when both present
        const normalizedFilters: TransactionFilters = {
          tickerSymbol: filters.tickerSymbol,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          page: 1,
          pageSize: 1000, // large enough to get all results
        };

        if (normalizedFilters.fromDate && normalizedFilters.toDate) {
          if (normalizedFilters.fromDate > normalizedFilters.toDate) {
            const temp = normalizedFilters.fromDate;
            normalizedFilters.fromDate = normalizedFilters.toDate;
            normalizedFilters.toDate = temp;
          }
        }

        // Act: apply filter
        const result = await service.getTransactions(normalizedFilters);

        // Get all records without filtering
        const allResult = await service.getTransactions({ page: 1, pageSize: 1000 });

        // Compute expected matches manually
        const expectedMatches = allResult.data.filter((txn) =>
          matchesFilter(txn, normalizedFilters),
        );

        // Assert: no matching record is excluded — result count equals expected count
        expect(result.data.length).toBe(expectedMatches.length);

        // Assert: every record that should match is present in results
        const resultIds = new Set(result.data.map((t) => t.id));
        for (const expected of expectedMatches) {
          expect(resultIds.has(expected.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('filtering with no criteria returns all records', async () => {
    await fc.assert(
      fc.asyncProperty(arbTransactions, async (txnInputs) => {
        // Setup: clear and populate repository
        repository.clear();
        for (const input of txnInputs) {
          await repository.create({
            userId: 'user-1',
            ...input,
          });
        }

        // Act: no filter criteria
        const result = await service.getTransactions({ page: 1, pageSize: 1000 });

        // Assert: all records returned
        expect(result.data.length).toBe(txnInputs.length);
      }),
      { numRuns: 100 },
    );
  });

  it('combining multiple filter criteria narrows results (subset property)', async () => {
    await fc.assert(
      fc.asyncProperty(arbTransactions, arbTicker, arbDate, async (txnInputs, ticker, date) => {
        // Setup: clear and populate repository
        repository.clear();
        for (const input of txnInputs) {
          await repository.create({
            userId: 'user-1',
            ...input,
          });
        }

        // Filter by ticker only
        const tickerOnly = await service.getTransactions({
          tickerSymbol: ticker,
          page: 1,
          pageSize: 1000,
        });

        // Filter by ticker AND fromDate
        const tickerAndDate = await service.getTransactions({
          tickerSymbol: ticker,
          fromDate: date,
          page: 1,
          pageSize: 1000,
        });

        // Assert: adding more criteria cannot increase results
        expect(tickerAndDate.data.length).toBeLessThanOrEqual(tickerOnly.data.length);

        // Assert: every result from the combined filter also appears in single-filter result
        const tickerOnlyIds = new Set(tickerOnly.data.map((t) => t.id));
        for (const txn of tickerAndDate.data) {
          expect(tickerOnlyIds.has(txn.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
