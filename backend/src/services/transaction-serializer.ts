import { StructuredTransaction } from '../types';

/**
 * Serialize a StructuredTransaction to a JSON string.
 *
 * Numeric fields are rounded to their canonical precision before
 * serialization so that the round-trip property holds:
 *   deserializeTransaction(serializeTransaction(txn)) deep-equals txn
 *
 * - price_per_share: 2 decimal places
 * - shares:          6 decimal places
 * - total_amount:    2 decimal places
 */
export function serializeTransaction(txn: StructuredTransaction): string {
  const normalized: StructuredTransaction = {
    ticker: txn.ticker,
    date: txn.date,
    price_per_share: roundTo(txn.price_per_share, 2),
    shares: roundTo(txn.shares, 6),
    total_amount: roundTo(txn.total_amount, 2),
  };
  return JSON.stringify(normalized);
}

/**
 * Deserialize a JSON string back into a StructuredTransaction.
 *
 * Applies the same precision rounding so that values produced by
 * `serializeTransaction` survive the round-trip unchanged.
 */
export function deserializeTransaction(json: string): StructuredTransaction {
  const parsed = JSON.parse(json) as StructuredTransaction;
  return {
    ticker: parsed.ticker,
    date: parsed.date,
    price_per_share: roundTo(parsed.price_per_share, 2),
    shares: roundTo(parsed.shares, 6),
    total_amount: roundTo(parsed.total_amount, 2),
  };
}

/**
 * Round a number to the given number of decimal places using
 * the "round half away from zero" strategy via Number.EPSILON
 * correction to avoid floating-point edge cases like
 * Math.round(1.005 * 100) === 100 instead of 101.
 */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
