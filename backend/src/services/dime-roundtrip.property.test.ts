// Feature: stock-portfolio-tracker, Property 19: Dime Import/Export Round-trip

import fc from 'fast-check';
import { DimeImportService } from './dime-import-service';
import { ExportService, ITransactionProvider } from './export-service';
import { ExportFilters, StructuredTransaction, Transaction } from '../types';
import { ITransactionRepository } from '../repositories/transaction-repository';

/**
 * Arbitrary generator for valid Dime CSV row data.
 *
 * - ticker: 1-5 uppercase ASCII letters
 * - date: valid ISO 8601 date (YYYY-MM-DD)
 * - price: positive number with up to 2 decimal places
 * - shares: positive number with up to 6 decimal places
 * - total: positive number with up to 2 decimal places
 */
const dimeTransactionArb = fc.record({
  ticker: fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 1, maxLength: 5 },
  ),
  date: fc
    .date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10)),
  price: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
  total: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
});

type DimeTransaction = {
  ticker: string;
  date: string;
  price: number;
  shares: number;
  total: number;
};

/**
 * Build a Dime-format CSV buffer from generated transactions.
 * Dime CSV has headers: ticker,date,price,shares,total
 */
function buildDimeCsvBuffer(transactions: DimeTransaction[]): Buffer {
  const header = 'ticker,date,price,shares,total';
  const rows = transactions.map(
    (t) => `${t.ticker},${t.date},${t.price},${t.shares},${t.total}`,
  );
  return Buffer.from([header, ...rows].join('\n'), 'utf-8');
}

/**
 * Convert StructuredTransaction[] to Transaction[] for the export service provider.
 */
function toTransactions(structured: StructuredTransaction[]): Transaction[] {
  return structured.map((s, i) => ({
    id: `id-${i}`,
    userId: 'default-user',
    tickerSymbol: s.ticker,
    transactionDate: s.date,
    pricePerShare: s.price_per_share,
    shares: s.shares,
    totalAmount: s.total_amount,
    source: 'dime_import' as const,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }));
}

/**
 * Create a mock ITransactionProvider that returns fixed transactions.
 */
function createMockProvider(transactions: Transaction[]): ITransactionProvider {
  return {
    getFilteredTransactions: async (_filters: ExportFilters) => transactions,
  };
}

/**
 * Create a minimal mock ITransactionRepository (unused in this test flow).
 */
function createMockRepository(): ITransactionRepository {
  return {
    findByUserAndTicker: async () => [],
    findAll: async () => ({ data: [], total: 0 }),
    create: async () => ({} as Transaction),
    update: async () => ({} as Transaction),
    delete: async () => {},
    findById: async () => null,
  } as unknown as ITransactionRepository;
}

describe('Dime Import/Export Round-trip (Property-Based)', () => {
  it('importFromCSV(exportToCSV(parseFile(dimeCSV))) deep-equals original parsed data', async () => {
    const repository = createMockRepository();
    const dimeService = new DimeImportService(repository, 'default-user');

    await fc.assert(
      fc.asyncProperty(
        fc.array(dimeTransactionArb, { minLength: 1, maxLength: 20 }),
        async (dimeTransactions) => {
          // Step 1: Build Dime-format CSV and import via DimeImportService.parseFile
          const dimeCsvBuffer = buildDimeCsvBuffer(dimeTransactions);
          const parseResult = dimeService.parseFile(dimeCsvBuffer, 'csv');

          // All generated rows should parse successfully
          expect(parseResult.errors).toHaveLength(0);
          expect(parseResult.transactions).toHaveLength(dimeTransactions.length);

          const originalParsed = parseResult.transactions;

          // Step 2: Export the parsed transactions via ExportService.exportToCSV
          const transactionsForExport = toTransactions(originalParsed);
          const provider = createMockProvider(transactionsForExport);
          const exportService = new ExportService(provider);
          const exportedCsv = await exportService.exportToCSV({ format: 'csv' });

          // Step 3: Import back via ExportService.importFromCSV
          const reimported: StructuredTransaction[] = exportService.importFromCSV(exportedCsv);

          // Step 4: Assert final data deep-equals original parsed data
          expect(reimported.length).toBe(originalParsed.length);

          for (let i = 0; i < originalParsed.length; i++) {
            const original = originalParsed[i];
            const result = reimported[i];

            expect(result.ticker).toBe(original.ticker);
            expect(result.date).toBe(original.date);
            expect(result.price_per_share).toBe(original.price_per_share);
            expect(result.shares).toBe(original.shares);
            expect(result.total_amount).toBe(original.total_amount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
