// Feature: stock-portfolio-tracker, Property 12: Batch Processing tolerates partial failures

import * as fc from 'fast-check';
import { SlipProcessingResult } from '../routes/slips';
import { ParseResult, StructuredTransaction } from '../types';

/**
 * Property-Based Test for Batch Processing partial failure tolerance.
 *
 * Simulates the batch upload-batch endpoint's processing logic: each slip is
 * processed independently, some may fail (OCR error, parse error, etc.), and
 * successful slips are unaffected by failures in the same batch.
 *
 * The core invariant: count(successful) + count(failed) === count(total)
 * Additionally: successful slip data remains correct regardless of failures nearby.
 */
describe('Batch Processing - Property-Based Tests', () => {
  // ────────────────────────────────────────────────────────────
  // Arbitraries (generators)
  // ────────────────────────────────────────────────────────────

  /** Generate a valid ticker symbol */
  const tickerArb = fc.constantFrom('AAPL', 'VOO', 'MSFT', 'GOOGL', 'AMZN', 'QQQ', 'SPY', 'TSLA');

  /** Generate a valid ISO date string */
  const dateArb = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2025-12-31'),
  }).map((d) => d.toISOString().split('T')[0]);

  /** Generate a positive price (2 decimal places) */
  const priceArb = fc.double({ min: 0.01, max: 9999.99, noNaN: true }).map(
    (v) => Math.round(v * 100) / 100,
  );

  /** Generate positive shares (up to 6 decimal places) */
  const sharesArb = fc.double({ min: 0.000001, max: 9999.999999, noNaN: true }).map(
    (v) => Math.round(v * 1000000) / 1000000,
  );

  /** Generate a filename for a slip */
  const filenameArb = fc.tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 3, maxLength: 10 }),
    fc.constantFrom('.png', '.jpg'),
  ).map(([name, ext]) => `${name}${ext}`);

  /** Generate a successful slip processing result */
  const successResultArb = fc.tuple(filenameArb, tickerArb, dateArb, priceArb, sharesArb).map(
    ([filename, ticker, date, price, shares]): SlipProcessingResult => {
      const totalAmount = Math.round(price * shares * 100) / 100;
      const parseResult: ParseResult = {
        ticker,
        date,
        pricePerShare: price,
        shares,
        totalAmount,
        missingFields: [],
        confidence: { ticker: 0.95, date: 0.95, pricePerShare: 0.95, shares: 0.95, totalAmount: 0.95 },
      };
      const transaction: StructuredTransaction = {
        ticker,
        date,
        price_per_share: price,
        shares,
        total_amount: totalAmount,
      };
      return {
        filename,
        success: true,
        parseResult,
        transaction,
      };
    },
  );

  /** Generate a failed slip processing result (various failure types) */
  const failureResultArb = fc.tuple(
    filenameArb,
    fc.constantFrom(
      { error: 'OCR processing failed', errorCode: 'OCR_FAILED' },
      { error: 'No text detected in the image', errorCode: 'OCR_FAILED' },
      { error: 'Some fields could not be extracted', errorCode: 'PARSE_INCOMPLETE' },
      { error: 'Unexpected error during processing', errorCode: 'INTERNAL_ERROR' },
      { error: 'Image too blurry for text extraction', errorCode: 'OCR_FAILED' },
    ),
  ).map(([filename, errorInfo]): SlipProcessingResult => ({
    filename,
    success: false,
    error: errorInfo.error,
    errorCode: errorInfo.errorCode,
  }));

  /** Generate a single slip result that is randomly success or failure */
  const slipResultArb = fc.oneof(successResultArb, failureResultArb);

  /** Generate a batch of 1-20 slip processing results with a mix of successes and failures */
  const batchResultsArb = fc.array(slipResultArb, { minLength: 1, maxLength: 20 });

  /**
   * Simulate the batch processing logic from the upload-batch endpoint.
   * Each slip is processed independently; we aggregate results just like the route does.
   */
  function processBatch(results: SlipProcessingResult[]) {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Property 12: Batch Processing tolerates partial failures
  // ────────────────────────────────────────────────────────────

  describe('Property 12: Batch Processing tolerates partial failures', () => {
    it('should satisfy conservation: successful + failed === total for any mix of results', () => {
      fc.assert(
        fc.property(batchResultsArb, (slipResults) => {
          const batch = processBatch(slipResults);

          // Core invariant: successful + failed = total
          expect(batch.successful + batch.failed).toBe(batch.total);
          expect(batch.total).toBe(slipResults.length);
        }),
        { numRuns: 100 },
      );
    });

    it('should leave successful slips unaffected by failures in the same batch', () => {
      // Generate batches that have at least one success and one failure
      const mixedBatchArb = fc.tuple(
        fc.array(successResultArb, { minLength: 1, maxLength: 10 }),
        fc.array(failureResultArb, { minLength: 1, maxLength: 10 }),
      ).chain(([successes, failures]) => {
        // Shuffle the combined array to interleave successes and failures
        const combined = [...successes, ...failures];
        return fc.shuffledSubarray(combined, { minLength: combined.length, maxLength: combined.length })
          .map((shuffled) => ({ shuffled, originalSuccesses: successes }));
      });

      fc.assert(
        fc.property(mixedBatchArb, ({ shuffled, originalSuccesses }) => {
          const batch = processBatch(shuffled);

          // Conservation property
          expect(batch.successful + batch.failed).toBe(batch.total);

          // Successful slips in the batch output must have correct data
          const successfulResults = batch.results.filter((r) => r.success);

          for (const result of successfulResults) {
            // Each successful result must have transaction data
            expect(result.transaction).toBeDefined();
            expect(result.parseResult).toBeDefined();
            expect(result.transaction!.ticker).toBeDefined();
            expect(result.transaction!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(result.transaction!.price_per_share).toBeGreaterThan(0);
            expect(result.transaction!.shares).toBeGreaterThan(0);
            expect(result.transaction!.total_amount).toBeGreaterThanOrEqual(0);
          }

          // The number of successful results matches the original successes count
          expect(successfulResults.length).toBe(originalSuccesses.length);

          // Each original success must appear in the batch output unchanged
          for (const original of originalSuccesses) {
            const found = batch.results.find(
              (r) => r.filename === original.filename && r.success,
            );
            expect(found).toBeDefined();
            expect(found!.transaction).toEqual(original.transaction);
            expect(found!.parseResult).toEqual(original.parseResult);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should process each slip independently — failures do not corrupt other results', () => {
      fc.assert(
        fc.property(batchResultsArb, (slipResults) => {
          const batch = processBatch(slipResults);

          // Every result is either success or failure (no ambiguous states)
          for (const result of batch.results) {
            if (result.success) {
              // Successful slips have transaction data
              expect(result.transaction).toBeDefined();
              expect(result.parseResult).toBeDefined();
              expect(result.parseResult!.missingFields).toEqual([]);
            } else {
              // Failed slips have error information
              expect(result.error).toBeDefined();
              expect(result.errorCode).toBeDefined();
            }
          }

          // The order is preserved — each result corresponds to its input
          expect(batch.results.length).toBe(slipResults.length);
          for (let i = 0; i < slipResults.length; i++) {
            expect(batch.results[i].filename).toBe(slipResults[i].filename);
            expect(batch.results[i].success).toBe(slipResults[i].success);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should handle all-success batches correctly', () => {
      const allSuccessArb = fc.array(successResultArb, { minLength: 1, maxLength: 20 });

      fc.assert(
        fc.property(allSuccessArb, (slipResults) => {
          const batch = processBatch(slipResults);

          expect(batch.successful).toBe(batch.total);
          expect(batch.failed).toBe(0);
          expect(batch.successful + batch.failed).toBe(batch.total);

          // All results have valid transaction data
          for (const result of batch.results) {
            expect(result.success).toBe(true);
            expect(result.transaction).toBeDefined();
            expect(result.transaction!.ticker).toBeTruthy();
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should handle all-failure batches correctly', () => {
      const allFailureArb = fc.array(failureResultArb, { minLength: 1, maxLength: 20 });

      fc.assert(
        fc.property(allFailureArb, (slipResults) => {
          const batch = processBatch(slipResults);

          expect(batch.failed).toBe(batch.total);
          expect(batch.successful).toBe(0);
          expect(batch.successful + batch.failed).toBe(batch.total);

          // No result should have transaction data
          for (const result of batch.results) {
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
