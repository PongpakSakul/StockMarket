// Feature: stock-portfolio-tracker, Property 17: Dime file parsing extracts all transactions

import fc from 'fast-check';
import { DimeImportService } from './dime-import-service';
import { StructuredTransaction } from '../types';

/**
 * Arbitrary generator for valid StructuredTransaction data used to build Dime files.
 *
 * - ticker: 1-5 uppercase ASCII letters
 * - date: valid ISO 8601 date string (YYYY-MM-DD)
 * - price_per_share: positive number with up to 2 decimal places
 * - shares: positive number with up to 6 decimal places
 * - total_amount: positive number with up to 2 decimal places
 */
const structuredTransactionArb: fc.Arbitrary<StructuredTransaction> = fc.record({
  ticker: fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 1, maxLength: 5 },
  ),
  date: fc
    .date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10)),
  price_per_share: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
  total_amount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
});

/**
 * Build a valid Dime CSV string from an array of StructuredTransaction objects.
 */
function buildDimeCSV(transactions: StructuredTransaction[]): string {
  const header = 'ticker,date,price,shares,total';
  const rows = transactions.map(
    (t) => `${t.ticker},${t.date},${t.price_per_share},${t.shares},${t.total_amount}`,
  );
  return [header, ...rows].join('\n');
}

/**
 * Build a valid Dime JSON string from an array of StructuredTransaction objects.
 */
function buildDimeJSON(transactions: StructuredTransaction[]): string {
  const items = transactions.map((t) => ({
    ticker: t.ticker,
    date: t.date,
    price: t.price_per_share,
    shares: t.shares,
    total: t.total_amount,
  }));
  return JSON.stringify(items);
}

/**
 * Create a DimeImportService instance without a real repository (not needed for parseFile).
 */
function createService(): DimeImportService {
  const mockRepository = {} as any;
  return new DimeImportService(mockRepository, 'test-user');
}

describe('Dime File Parsing (Property-Based)', () => {
  const service = createService();

  it('CSV: parsed transaction count equals row count and each transaction has all required fields', () => {
    fc.assert(
      fc.property(
        fc.array(structuredTransactionArb, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const csvContent = buildDimeCSV(transactions);
          const fileBuffer = Buffer.from(csvContent, 'utf-8');

          const result = service.parseFile(fileBuffer, 'csv');

          // Parsed transaction count must equal input row count
          expect(result.transactions.length).toBe(transactions.length);
          expect(result.totalRows).toBe(transactions.length);
          expect(result.successfulRows).toBe(transactions.length);
          expect(result.errors.length).toBe(0);

          // Each parsed transaction has all required fields
          for (const txn of result.transactions) {
            expect(txn.ticker).toBeDefined();
            expect(typeof txn.ticker).toBe('string');
            expect(txn.ticker.length).toBeGreaterThan(0);

            expect(txn.date).toBeDefined();
            expect(typeof txn.date).toBe('string');
            expect(txn.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            expect(txn.price_per_share).toBeDefined();
            expect(typeof txn.price_per_share).toBe('number');
            expect(txn.price_per_share).toBeGreaterThan(0);

            expect(txn.shares).toBeDefined();
            expect(typeof txn.shares).toBe('number');
            expect(txn.shares).toBeGreaterThan(0);

            expect(txn.total_amount).toBeDefined();
            expect(typeof txn.total_amount).toBe('number');
            expect(txn.total_amount).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('JSON: parsed transaction count equals row count and each transaction has all required fields', () => {
    fc.assert(
      fc.property(
        fc.array(structuredTransactionArb, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const jsonContent = buildDimeJSON(transactions);
          const fileBuffer = Buffer.from(jsonContent, 'utf-8');

          const result = service.parseFile(fileBuffer, 'json');

          // Parsed transaction count must equal input row count
          expect(result.transactions.length).toBe(transactions.length);
          expect(result.totalRows).toBe(transactions.length);
          expect(result.successfulRows).toBe(transactions.length);
          expect(result.errors.length).toBe(0);

          // Each parsed transaction has all required fields
          for (const txn of result.transactions) {
            expect(txn.ticker).toBeDefined();
            expect(typeof txn.ticker).toBe('string');
            expect(txn.ticker.length).toBeGreaterThan(0);

            expect(txn.date).toBeDefined();
            expect(typeof txn.date).toBe('string');
            expect(txn.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

            expect(txn.price_per_share).toBeDefined();
            expect(typeof txn.price_per_share).toBe('number');
            expect(txn.price_per_share).toBeGreaterThan(0);

            expect(txn.shares).toBeDefined();
            expect(typeof txn.shares).toBe('number');
            expect(txn.shares).toBeGreaterThan(0);

            expect(txn.total_amount).toBeDefined();
            expect(typeof txn.total_amount).toBe('number');
            expect(txn.total_amount).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('CSV: parsed transactions preserve original data values', () => {
    fc.assert(
      fc.property(
        fc.array(structuredTransactionArb, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const csvContent = buildDimeCSV(transactions);
          const fileBuffer = Buffer.from(csvContent, 'utf-8');

          const result = service.parseFile(fileBuffer, 'csv');

          // Each parsed transaction should match the original input values
          for (let i = 0; i < transactions.length; i++) {
            const original = transactions[i];
            const parsed = result.transactions[i];

            expect(parsed.ticker).toBe(original.ticker.toUpperCase());
            expect(parsed.date).toBe(original.date);
            expect(parsed.price_per_share).toBe(original.price_per_share);
            expect(parsed.shares).toBe(original.shares);
            expect(parsed.total_amount).toBe(original.total_amount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('JSON: parsed transactions preserve original data values', () => {
    fc.assert(
      fc.property(
        fc.array(structuredTransactionArb, { minLength: 1, maxLength: 20 }),
        (transactions) => {
          const jsonContent = buildDimeJSON(transactions);
          const fileBuffer = Buffer.from(jsonContent, 'utf-8');

          const result = service.parseFile(fileBuffer, 'json');

          // Each parsed transaction should match the original input values
          for (let i = 0; i < transactions.length; i++) {
            const original = transactions[i];
            const parsed = result.transactions[i];

            expect(parsed.ticker).toBe(original.ticker.toUpperCase());
            expect(parsed.date).toBe(original.date);
            expect(parsed.price_per_share).toBe(original.price_per_share);
            expect(parsed.shares).toBe(original.shares);
            expect(parsed.total_amount).toBe(original.total_amount);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
