import { serializeTransaction, deserializeTransaction } from './transaction-serializer';
import { StructuredTransaction } from '../types';

describe('transaction-serializer', () => {
  // -----------------------------------------------------------
  // serializeTransaction
  // -----------------------------------------------------------
  describe('serializeTransaction', () => {
    it('should produce valid JSON containing all fields', () => {
      const txn: StructuredTransaction = {
        ticker: 'VOO',
        date: '2024-03-15',
        price_per_share: 450.25,
        shares: 1.123456,
        total_amount: 505.59,
      };

      const json = serializeTransaction(txn);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual({
        ticker: 'VOO',
        date: '2024-03-15',
        price_per_share: 450.25,
        shares: 1.123456,
        total_amount: 505.59,
      });
    });

    it('should round price_per_share to 2 decimal places', () => {
      const txn: StructuredTransaction = {
        ticker: 'AAPL',
        date: '2024-01-01',
        price_per_share: 150.999,
        shares: 1,
        total_amount: 151,
      };

      const json = serializeTransaction(txn);
      const parsed = JSON.parse(json);

      expect(parsed.price_per_share).toBe(151);
    });

    it('should round shares to 6 decimal places', () => {
      const txn: StructuredTransaction = {
        ticker: 'QQQM',
        date: '2024-06-01',
        price_per_share: 100,
        shares: 0.1234567,
        total_amount: 12.35,
      };

      const json = serializeTransaction(txn);
      const parsed = JSON.parse(json);

      expect(parsed.shares).toBe(0.123457);
    });

    it('should round total_amount to 2 decimal places', () => {
      const txn: StructuredTransaction = {
        ticker: 'SPY',
        date: '2024-02-28',
        price_per_share: 500,
        shares: 0.5,
        total_amount: 250.005,
      };

      const json = serializeTransaction(txn);
      const parsed = JSON.parse(json);

      expect(parsed.total_amount).toBe(250.01);
    });
  });

  // -----------------------------------------------------------
  // deserializeTransaction
  // -----------------------------------------------------------
  describe('deserializeTransaction', () => {
    it('should reconstruct a StructuredTransaction from JSON', () => {
      const json = JSON.stringify({
        ticker: 'MSFT',
        date: '2024-04-10',
        price_per_share: 420.5,
        shares: 2.5,
        total_amount: 1051.25,
      });

      const txn = deserializeTransaction(json);

      expect(txn).toEqual({
        ticker: 'MSFT',
        date: '2024-04-10',
        price_per_share: 420.5,
        shares: 2.5,
        total_amount: 1051.25,
      });
    });

    it('should apply precision rounding on deserialization', () => {
      const json = JSON.stringify({
        ticker: 'TSLA',
        date: '2024-05-20',
        price_per_share: 175.1119,
        shares: 3.00000019,
        total_amount: 525.339,
      });

      const txn = deserializeTransaction(json);

      expect(txn.price_per_share).toBe(175.11);
      expect(txn.shares).toBe(3);
      expect(txn.total_amount).toBe(525.34);
    });
  });

  // -----------------------------------------------------------
  // Round-trip (Requirement 4.5)
  // -----------------------------------------------------------
  describe('round-trip', () => {
    it('should preserve all fields through serialize → deserialize', () => {
      const original: StructuredTransaction = {
        ticker: 'VOO',
        date: '2024-03-15',
        price_per_share: 450.25,
        shares: 1.123456,
        total_amount: 505.59,
      };

      const result = deserializeTransaction(serializeTransaction(original));

      expect(result).toEqual(original);
    });

    it('should preserve precision for small fractional shares', () => {
      const original: StructuredTransaction = {
        ticker: 'QQQM',
        date: '2024-01-01',
        price_per_share: 0.01,
        shares: 0.000001,
        total_amount: 0.01,
      };

      const result = deserializeTransaction(serializeTransaction(original));

      expect(result).toEqual(original);
    });

    it('should preserve precision for large values', () => {
      const original: StructuredTransaction = {
        ticker: 'BRK.A',
        date: '2024-07-04',
        price_per_share: 99999.99,
        shares: 999.999999,
        total_amount: 99999.99,
      };

      const result = deserializeTransaction(serializeTransaction(original));

      expect(result).toEqual(original);
    });

    it('should normalize values that exceed canonical precision', () => {
      const input: StructuredTransaction = {
        ticker: 'AAPL',
        date: '2024-08-01',
        price_per_share: 150.456,
        shares: 2.1234567,
        total_amount: 319.999,
      };

      const result = deserializeTransaction(serializeTransaction(input));

      // After first serialize the values are rounded, so the round-trip
      // of the *rounded* values must be stable.
      const secondResult = deserializeTransaction(serializeTransaction(result));
      expect(secondResult).toEqual(result);
    });
  });
});
