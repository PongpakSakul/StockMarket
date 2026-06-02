// Feature: stock-portfolio-tracker, Property 10: CSV Export/Import Round-trip

import fc from 'fast-check';
import { ExportService, ITransactionProvider } from './export-service';
import { ExportFilters, Transaction, StructuredTransaction } from '../types';

/**
 * Arbitrary generator for valid Transaction objects suitable for CSV round-trip.
 *
 * - tickerSymbol: 1-5 uppercase ASCII letters (no commas, quotes, or newlines to avoid CSV escaping edge cases with floats)
 * - transactionDate: ISO date string (YYYY-MM-DD)
 * - pricePerShare: positive number with up to 2 decimal places
 * - shares: positive number with up to 6 decimal places
 * - totalAmount: positive number with up to 2 decimal places
 */
const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  tickerSymbol: fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 1, maxLength: 5 },
  ),
  transactionDate: fc
    .date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10)),
  pricePerShare: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
  totalAmount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  source: fc.constant('manual' as const),
  createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00.000Z'),
});

/**
 * Create a mock ITransactionProvider that returns a fixed set of transactions.
 */
function createMockProvider(transactions: Transaction[]): ITransactionProvider {
  return {
    getFilteredTransactions: async (_filters: ExportFilters) => transactions,
  };
}

describe('CSV Export/Import Round-trip (Property-Based)', () => {
  it('importFromCSV(exportToCSV(transactions)) deep-equals originals', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(transactionArb, { minLength: 1, maxLength: 20 }),
        async (transactions) => {
          const provider = createMockProvider(transactions);
          const service = new ExportService(provider);

          // Export to CSV
          const csvBuffer = await service.exportToCSV({ format: 'csv' });

          // Import from CSV
          const imported: StructuredTransaction[] = service.importFromCSV(csvBuffer);

          // Assert same number of transactions
          expect(imported.length).toBe(transactions.length);

          // Assert each imported transaction matches the original
          for (let i = 0; i < transactions.length; i++) {
            const original = transactions[i];
            const result = imported[i];

            expect(result.ticker).toBe(original.tickerSymbol);
            expect(result.date).toBe(original.transactionDate);
            expect(result.price_per_share).toBe(original.pricePerShare);
            expect(result.shares).toBe(original.shares);
            expect(result.total_amount).toBe(original.totalAmount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
