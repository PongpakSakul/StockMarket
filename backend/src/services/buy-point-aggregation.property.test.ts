// Feature: stock-portfolio-tracker, Property 4: Buy Point Markers aggregate by date

import fc from 'fast-check';
import { Transaction, BuyPoint } from '../types';
import { TransactionService } from './transaction-service';
import {
  ITransactionRepository,
  PaginatedResult,
} from '../repositories/transaction-repository';

/**
 * Pure aggregation logic extracted to test the property without async dependencies.
 * Mirrors TransactionService.getBuyPointsForTicker grouping logic.
 */
function aggregateBuyPoints(transactions: Transaction[]): BuyPoint[] {
  const grouped = new Map<
    string,
    { shares: number; totalAmount: number; count: number }
  >();

  for (const txn of transactions) {
    const existing = grouped.get(txn.transactionDate);
    if (existing) {
      existing.shares += txn.shares;
      existing.totalAmount += txn.totalAmount;
      existing.count += 1;
    } else {
      grouped.set(txn.transactionDate, {
        shares: txn.shares,
        totalAmount: txn.totalAmount,
        count: 1,
      });
    }
  }

  const buyPoints: BuyPoint[] = [];
  for (const [date, agg] of grouped) {
    buyPoints.push({
      date,
      pricePerShare: agg.shares > 0 ? agg.totalAmount / agg.shares : 0,
      shares: agg.shares,
      totalAmount: agg.totalAmount,
      transactionCount: agg.count,
    });
  }

  buyPoints.sort((a, b) => a.date.localeCompare(b.date));
  return buyPoints;
}

/**
 * Arbitrary generator for a pool of date strings (YYYY-MM-DD).
 * We generate a small pool so that some transactions will share dates.
 */
const datePoolArb = fc
  .uniqueArray(
    fc
      .date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') })
      .map((d) => d.toISOString().slice(0, 10)),
    { minLength: 1, maxLength: 5 },
  );

/**
 * Arbitrary generator for a list of transactions that share dates from a pool.
 * Ensures some transactions will have the same transactionDate.
 */
const transactionSetArb: fc.Arbitrary<Transaction[]> = datePoolArb.chain(
  (dates) =>
    fc.array(
      fc.record({
        id: fc.uuid(),
        userId: fc.uuid(),
        tickerSymbol: fc.constant('AAPL'),
        transactionDate: fc.constantFrom(...dates),
        pricePerShare: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
        shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
        totalAmount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
        source: fc.constant('manual' as const),
        createdAt: fc.constant('2024-01-01T00:00:00Z'),
        updatedAt: fc.constant('2024-01-01T00:00:00Z'),
      }),
      { minLength: 1, maxLength: 30 },
    ),
);

describe('Buy Point Aggregation by Date (Property-Based)', () => {
  it('marker count equals unique date count and each marker transactionCount matches actual count for that date', () => {
    fc.assert(
      fc.property(transactionSetArb, (transactions) => {
        const buyPoints = aggregateBuyPoints(transactions);

        // Compute expected unique dates and counts
        const dateCounts = new Map<string, number>();
        for (const txn of transactions) {
          dateCounts.set(
            txn.transactionDate,
            (dateCounts.get(txn.transactionDate) ?? 0) + 1,
          );
        }

        // Property: marker count === unique date count
        expect(buyPoints.length).toBe(dateCounts.size);

        // Property: each marker's transactionCount matches actual count for that date
        for (const bp of buyPoints) {
          expect(bp.transactionCount).toBe(dateCounts.get(bp.date));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('service getBuyPointsForTicker produces correct aggregation via repository', async () => {
    await fc.assert(
      fc.asyncProperty(transactionSetArb, async (transactions) => {
        // Mock repository that returns the generated transactions
        const mockRepository: ITransactionRepository = {
          findAll: async (): Promise<PaginatedResult<Transaction>> => ({
            data: transactions,
            total: transactions.length,
            page: 1,
            pageSize: 100_000,
            totalPages: 1,
          }),
          findById: async () => null,
          create: async () => transactions[0],
          update: async () => null,
          delete: async () => false,
          findByUserAndTicker: async () => [],
        };

        const service = new TransactionService(mockRepository);
        const buyPoints = await service.getBuyPointsForTicker('AAPL');

        // Compute expected unique dates and counts
        const dateCounts = new Map<string, number>();
        for (const txn of transactions) {
          dateCounts.set(
            txn.transactionDate,
            (dateCounts.get(txn.transactionDate) ?? 0) + 1,
          );
        }

        // Property: marker count === unique date count
        expect(buyPoints.length).toBe(dateCounts.size);

        // Property: each marker's transactionCount matches actual count for that date
        for (const bp of buyPoints) {
          expect(bp.transactionCount).toBe(dateCounts.get(bp.date));
        }
      }),
      { numRuns: 100 },
    );
  });
});
