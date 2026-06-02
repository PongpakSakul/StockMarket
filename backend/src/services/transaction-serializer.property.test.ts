// Feature: stock-portfolio-tracker, Property 1: StructuredTransaction JSON Round-trip

import fc from 'fast-check';
import { serializeTransaction, deserializeTransaction } from './transaction-serializer';
import { StructuredTransaction } from '../types';

/**
 * Arbitrary generator for valid StructuredTransaction objects.
 *
 * - ticker: 1-5 uppercase ASCII letters
 * - date: ISO date string (YYYY-MM-DD) with valid calendar dates
 * - price_per_share: positive number rounded to 2 decimal places
 * - shares: positive number rounded to 6 decimal places
 * - total_amount: positive number rounded to 2 decimal places
 */
const structuredTransactionArb: fc.Arbitrary<StructuredTransaction> = fc.record({
  ticker: fc
    .stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
  date: fc
    .date({
      min: new Date('1970-01-01'),
      max: new Date('2099-12-31'),
    })
    .map((d) => d.toISOString().slice(0, 10)),
  price_per_share: fc
    .integer({ min: 1, max: 9999999 })
    .map((n) => n / 100), // positive, 2 decimal places
  shares: fc
    .integer({ min: 1, max: 999999999 })
    .map((n) => n / 1000000), // positive, 6 decimal places
  total_amount: fc
    .integer({ min: 1, max: 9999999 })
    .map((n) => n / 100), // positive, 2 decimal places
});

describe('StructuredTransaction JSON Round-trip (Property-Based)', () => {
  it('deserializeTransaction(serializeTransaction(txn)) deep-equals original', () => {
    fc.assert(
      fc.property(structuredTransactionArb, (txn) => {
        const result = deserializeTransaction(serializeTransaction(txn));

        expect(result).toEqual(txn);
      }),
      { numRuns: 100 },
    );
  });
});
