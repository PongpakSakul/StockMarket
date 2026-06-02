// Feature: stock-portfolio-tracker, Property 13: Only selected items from batch are saved

import * as fc from 'fast-check';
import { StructuredTransaction } from '../types';
import { SlipProcessingResult } from '../routes/slips';
import { TransactionService } from './transaction-service';
import {
  InMemoryTransactionRepository,
  CreateTransactionDTO,
} from '../repositories/transaction-repository';
import { KNOWN_TICKER_LIST } from './slip-parser';

// ────────────────────────────────────────────────────────────
// Selective Batch Save Logic
// ────────────────────────────────────────────────────────────

/**
 * Implements the selective batch save pattern:
 * Given batch processing results and a boolean selection mask,
 * saves only the selected successful items as transactions.
 *
 * This mirrors the frontend → backend flow where users review batch
 * OCR results and choose which ones to confirm/save.
 */
async function selectiveBatchSave(
  batchResults: SlipProcessingResult[],
  selectedIndices: boolean[],
  transactionService: TransactionService,
  userId: string,
): Promise<{ savedCount: number; savedItems: StructuredTransaction[] }> {
  const savedItems: StructuredTransaction[] = [];

  for (let i = 0; i < batchResults.length; i++) {
    const result = batchResults[i];

    // Only save if: selected by user AND successfully parsed with transaction data
    if (selectedIndices[i] && result.success && result.transaction) {
      const dto: CreateTransactionDTO = {
        userId,
        tickerSymbol: result.transaction.ticker,
        transactionDate: result.transaction.date,
        pricePerShare: result.transaction.price_per_share,
        shares: result.transaction.shares,
        totalAmount: result.transaction.total_amount,
        source: 'ocr',
      };

      await transactionService.createTransaction(dto);
      savedItems.push(result.transaction);
    }
  }

  return { savedCount: savedItems.length, savedItems };
}

// ────────────────────────────────────────────────────────────
// Arbitraries (generators)
// ────────────────────────────────────────────────────────────

/** Pick a random known ticker for valid transactions */
const tickerArb = fc.constantFrom(...KNOWN_TICKER_LIST);

/** Generate a valid past date (YYYY-MM-DD) between 2020 and 2024 */
const dateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2024 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) => {
  const mm = month.toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${year}-${mm}-${dd}`;
});

/** Generate a positive price (2 decimal places) */
const priceArb = fc.double({ min: 1.0, max: 9999.99, noNaN: true }).map(
  (v) => Math.round(v * 100) / 100,
);

/** Generate a positive shares value (up to 6 decimal places) */
const sharesArb = fc.double({ min: 0.01, max: 999.999999, noNaN: true }).map(
  (v) => Math.round(v * 1000000) / 1000000,
);

/** Generate a single successful SlipProcessingResult */
const successfulResultArb = fc.tuple(tickerArb, dateArb, priceArb, sharesArb).map(
  ([ticker, date, price, shares]): SlipProcessingResult => {
    const totalAmount = Math.round(price * shares * 100) / 100;
    return {
      filename: `slip-${ticker}-${date}.png`,
      success: true,
      parseResult: {
        ticker,
        date,
        pricePerShare: price,
        shares,
        totalAmount,
        missingFields: [],
        confidence: { ticker: 0.95, date: 0.95, pricePerShare: 0.95, shares: 0.95 },
      },
      transaction: {
        ticker,
        date,
        price_per_share: price,
        shares,
        total_amount: totalAmount,
      },
    };
  },
);

/** Generate a batch of 1-20 successful results */
const batchResultsArb = fc.array(successfulResultArb, { minLength: 1, maxLength: 20 });

/**
 * Generate a boolean selection array matching the batch length.
 * Each element is independently true/false.
 */
function selectionArbForLength(length: number): fc.Arbitrary<boolean[]> {
  return fc.array(fc.boolean(), { minLength: length, maxLength: length });
}

// ────────────────────────────────────────────────────────────
// Property-Based Tests
// ────────────────────────────────────────────────────────────

describe('Selective Batch Save - Property-Based Tests', () => {
  let repository: InMemoryTransactionRepository;
  let service: TransactionService;

  beforeEach(() => {
    repository = new InMemoryTransactionRepository();
    service = new TransactionService(repository);
  });

  describe('Property 13: Only selected items from batch are saved', () => {
    it('saved count equals number of selected items', async () => {
      await fc.assert(
        fc.asyncProperty(
          batchResultsArb.chain((results) =>
            selectionArbForLength(results.length).map((selection) => ({
              results,
              selection,
            })),
          ),
          async ({ results, selection }) => {
            // Clear repository for each iteration
            repository.clear();

            const expectedCount = selection.filter((s) => s).length;

            const { savedCount } = await selectiveBatchSave(
              results,
              selection,
              service,
              'user-test-123',
            );

            // Property: saved count === number of selected items
            expect(savedCount).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('all saved items are in the selected subset', async () => {
      await fc.assert(
        fc.asyncProperty(
          batchResultsArb.chain((results) =>
            selectionArbForLength(results.length).map((selection) => ({
              results,
              selection,
            })),
          ),
          async ({ results, selection }) => {
            // Clear repository for each iteration
            repository.clear();

            const { savedItems } = await selectiveBatchSave(
              results,
              selection,
              service,
              'user-test-123',
            );

            // Build set of selected transactions for comparison
            const selectedTransactions = results
              .filter((_, i) => selection[i] && results[i].success && results[i].transaction)
              .map((r) => r.transaction!);

            // Property: every saved item exists in the selected subset
            for (const saved of savedItems) {
              const found = selectedTransactions.some(
                (selected) =>
                  selected.ticker === saved.ticker &&
                  selected.date === saved.date &&
                  selected.price_per_share === saved.price_per_share &&
                  selected.shares === saved.shares &&
                  selected.total_amount === saved.total_amount,
              );
              expect(found).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('unselected items are never persisted to the repository', async () => {
      await fc.assert(
        fc.asyncProperty(
          batchResultsArb.chain((results) =>
            selectionArbForLength(results.length).map((selection) => ({
              results,
              selection,
            })),
          ),
          async ({ results, selection }) => {
            // Clear repository for each iteration
            repository.clear();

            await selectiveBatchSave(results, selection, service, 'user-test-123');

            // Query all persisted transactions
            const allSaved = await repository.findAll({ page: 1, pageSize: 10000 });

            // Build set of unselected transactions
            const unselectedTransactions = results
              .filter((_, i) => !selection[i])
              .map((r) => r.transaction)
              .filter((t): t is StructuredTransaction => t !== undefined);

            // Property: no unselected item should appear in persisted data
            for (const unselected of unselectedTransactions) {
              const found = allSaved.data.some(
                (persisted) =>
                  persisted.tickerSymbol === unselected.ticker &&
                  persisted.transactionDate === unselected.date &&
                  persisted.pricePerShare === unselected.price_per_share &&
                  persisted.shares === unselected.shares &&
                  persisted.totalAmount === unselected.total_amount,
              );
              expect(found).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('repository contains exactly the selected count of transactions', async () => {
      await fc.assert(
        fc.asyncProperty(
          batchResultsArb.chain((results) =>
            selectionArbForLength(results.length).map((selection) => ({
              results,
              selection,
            })),
          ),
          async ({ results, selection }) => {
            // Clear repository for each iteration
            repository.clear();

            const expectedCount = selection.filter((s) => s).length;

            await selectiveBatchSave(results, selection, service, 'user-test-123');

            // Verify actual stored count in repository
            const allSaved = await repository.findAll({ page: 1, pageSize: 10000 });

            // Property: persisted transaction count === selected count
            expect(allSaved.total).toBe(expectedCount);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
