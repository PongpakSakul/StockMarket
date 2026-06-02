// Feature: stock-portfolio-tracker, Property 11: Exported data has all required fields

import fc from 'fast-check';
import { ExportService, ITransactionProvider } from './export-service';
import { ExportFilters, Transaction } from '../types';

/**
 * Arbitrary generator for valid Transaction objects used in export.
 *
 * - tickerSymbol: 1-5 uppercase ASCII letters
 * - transactionDate: ISO date string (YYYY-MM-DD)
 * - pricePerShare: positive number rounded to 2 decimal places
 * - shares: positive number rounded to 6 decimal places
 * - totalAmount: positive number rounded to 2 decimal places
 * - Other fields use plausible fixed or generated values
 */
const transactionArb: fc.Arbitrary<Transaction> = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  tickerSymbol: fc.stringOf(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    { minLength: 1, maxLength: 5 },
  ),
  transactionDate: fc
    .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10)),
  pricePerShare: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
  totalAmount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  source: fc.constantFrom('manual' as const, 'ocr' as const, 'dime_import' as const),
  slipImageUrl: fc.constant(undefined),
  ocrRawText: fc.constant(undefined),
  createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
  updatedAt: fc.constant('2024-01-01T00:00:00.000Z'),
});

/** Generate non-empty arrays of transactions */
const transactionSetArb = fc.array(transactionArb, { minLength: 1, maxLength: 50 });

/** Required CSV column names */
const REQUIRED_FIELDS = ['ticker', 'date', 'price_per_share', 'shares', 'total_amount'];

/**
 * Creates a mock ITransactionProvider that returns the given transactions.
 */
function createMockProvider(transactions: Transaction[]): ITransactionProvider {
  return {
    getFilteredTransactions: async (_filters: ExportFilters) => transactions,
  };
}

describe('Export Completeness (Property-Based)', () => {
  it('every exported CSV row contains all required fields (ticker, date, price_per_share, shares, total_amount)', async () => {
    await fc.assert(
      fc.asyncProperty(transactionSetArb, async (transactions) => {
        const provider = createMockProvider(transactions);
        const exportService = new ExportService(provider);

        const csvBuffer = await exportService.exportToCSV({ format: 'csv' });
        const csvContent = csvBuffer.toString('utf-8');
        const lines = csvContent.split('\n');

        // First line must be the header
        const headerLine = lines[0];
        const headers = headerLine.split(',');
        for (const field of REQUIRED_FIELDS) {
          expect(headers).toContain(field);
        }

        // Data lines (skip header)
        const dataLines = lines.slice(1).filter((line) => line.trim() !== '');

        // There should be exactly one data row per transaction
        expect(dataLines.length).toBe(transactions.length);

        // Each data row must have all fields present and non-empty
        for (const dataLine of dataLines) {
          const values = parseCsvLine(dataLine);

          // Must have at least 5 fields
          expect(values.length).toBeGreaterThanOrEqual(REQUIRED_FIELDS.length);

          // Map header indices to check each required field
          const tickerIdx = headers.indexOf('ticker');
          const dateIdx = headers.indexOf('date');
          const priceIdx = headers.indexOf('price_per_share');
          const sharesIdx = headers.indexOf('shares');
          const totalIdx = headers.indexOf('total_amount');

          // Each required field must be non-empty and not "undefined" or "null"
          const fieldValues = [
            values[tickerIdx],
            values[dateIdx],
            values[priceIdx],
            values[sharesIdx],
            values[totalIdx],
          ];

          for (let i = 0; i < fieldValues.length; i++) {
            const val = fieldValues[i];
            expect(val).toBeDefined();
            expect(val.trim()).not.toBe('');
            expect(val.trim().toLowerCase()).not.toBe('undefined');
            expect(val.trim().toLowerCase()).not.toBe('null');
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ────────────────────────────────────────────────────────────
// CSV Line Parser (handles quoted fields)
// ────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}
