// Feature: stock-portfolio-tracker, Property 18: Duplicate detection is accurate

import fc from 'fast-check';
import { DimeImportService } from './dime-import-service';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';
import { StructuredTransaction } from '../types';

/**
 * Arbitrary generator for a valid StructuredTransaction.
 * - ticker: 1-5 uppercase letters
 * - date: ISO date string (YYYY-MM-DD)
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
    .date({ min: new Date('2000-01-01'), max: new Date('2099-12-31') })
    .map((d) => d.toISOString().slice(0, 10)),
  price_per_share: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999999 }).map((n) => n / 1000000),
  total_amount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
});

describe('Duplicate Detection (Property-Based)', () => {
  it('duplicates + unique === total imported, and duplicates match on ticker + date + price + shares', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate existing transactions (already in system)
        fc.array(structuredTransactionArb, { minLength: 1, maxLength: 10 }),
        // Generate unique-only imported transactions (guaranteed different)
        fc.array(structuredTransactionArb, { minLength: 0, maxLength: 10 }),
        // Boolean array to select which existing transactions will be duplicated in import
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        async (existingStructured, uniqueImported, duplicateFlags) => {
          const userId = 'test-user';
          const repository = new InMemoryTransactionRepository();
          repository.clear();

          // Seed the repository with "existing" transactions
          for (const txn of existingStructured) {
            await repository.create({
              userId,
              tickerSymbol: txn.ticker,
              transactionDate: txn.date,
              pricePerShare: txn.price_per_share,
              shares: txn.shares,
              totalAmount: txn.total_amount,
              source: 'dime_import',
            });
          }

          // Build imported transactions: some are duplicates of existing, some are unique
          const importedTransactions: StructuredTransaction[] = [];

          // Add duplicates: pick existing transactions based on flags
          for (let i = 0; i < existingStructured.length; i++) {
            if (duplicateFlags[i]) {
              importedTransactions.push({ ...existingStructured[i] });
            }
          }

          // Add unique transactions that differ from existing ones
          // To guarantee uniqueness, mutate the ticker by appending 'Z'
          for (const txn of uniqueImported) {
            const uniqueTxn: StructuredTransaction = {
              ...txn,
              ticker: txn.ticker + 'Z', // ensures it won't collide with existing tickers (max 6 chars, still valid)
            };
            importedTransactions.push(uniqueTxn);
          }

          const expectedDuplicateCount = existingStructured.filter(
            (_, i) => duplicateFlags[i],
          ).length;
          const expectedUniqueCount = importedTransactions.length - expectedDuplicateCount;

          // Run duplicate detection
          const service = new DimeImportService(repository, userId);
          const result = await service.detectDuplicates(importedTransactions);

          // Property 1: duplicates + unique === total imported
          expect(result.duplicates.length + result.unique.length).toBe(
            importedTransactions.length,
          );

          // Property 2: every duplicate matches an existing transaction on (ticker, date, price, shares)
          for (const dup of result.duplicates) {
            expect(dup.existing.tickerSymbol).toBe(dup.imported.ticker);
            expect(dup.existing.transactionDate).toBe(dup.imported.date);
            expect(dup.existing.pricePerShare).toBe(dup.imported.price_per_share);
            expect(dup.existing.shares).toBe(dup.imported.shares);
          }

          // Property 3: every unique item does NOT match any existing transaction
          const allExisting = await Promise.all(
            [...new Set(importedTransactions.map((t) => t.ticker))].map((ticker) =>
              repository.findByUserAndTicker(userId, ticker),
            ),
          );
          const existingFlat = allExisting.flat();

          for (const uniqueTxn of result.unique) {
            const hasMatch = existingFlat.some(
              (existing) =>
                existing.tickerSymbol === uniqueTxn.ticker &&
                existing.transactionDate === uniqueTxn.date &&
                existing.pricePerShare === uniqueTxn.price_per_share &&
                existing.shares === uniqueTxn.shares,
            );
            expect(hasMatch).toBe(false);
          }

          // Verify counts are consistent
          expect(result.duplicates.length).toBe(expectedDuplicateCount);
          expect(result.unique.length).toBe(expectedUniqueCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
