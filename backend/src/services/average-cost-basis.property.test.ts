// Feature: stock-portfolio-tracker, Property 3: Average Cost Basis = sum(total_amount) / sum(shares)

import fc from 'fast-check';
import { Transaction } from '../types';
import { PortfolioService } from './portfolio-service';

/**
 * Arbitrary generator for an array of transactions with positive totalAmount and shares.
 * Generates 1-20 transactions with realistic positive values.
 */
const transactionSetArb: fc.Arbitrary<Transaction[]> = fc.array(
  fc.record({
    id: fc.uuid(),
    userId: fc.uuid(),
    tickerSymbol: fc.constant('AAPL'),
    transactionDate: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') })
      .map((d) => d.toISOString().slice(0, 10)),
    pricePerShare: fc.integer({ min: 1, max: 10000000 }).map((n) => n / 100),
    shares: fc.integer({ min: 1, max: 100000000000 }).map((n) => n / 1000000),
    totalAmount: fc.integer({ min: 1, max: 10000000 }).map((n) => n / 100),
    source: fc.constant('manual' as const),
    createdAt: fc.constant('2024-01-01T00:00:00Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00Z'),
  }),
  { minLength: 1, maxLength: 20 },
);

describe('Average Cost Basis Calculation (Property-Based)', () => {
  // Create a minimal PortfolioService instance (only calculateAverageCostBasis is used, no deps needed)
  const service = new PortfolioService(
    null as any,
    null as any,
    null as any,
    null as any,
  );

  it('average cost basis equals sum(total_amount) / sum(shares) within floating-point tolerance', () => {
    fc.assert(
      fc.property(transactionSetArb, (transactions) => {
        const result = service.calculateAverageCostBasis(transactions);

        const expectedTotalAmount = transactions.reduce(
          (sum, t) => sum + t.totalAmount,
          0,
        );
        const expectedTotalShares = transactions.reduce(
          (sum, t) => sum + t.shares,
          0,
        );
        const expected = expectedTotalAmount / expectedTotalShares;

        // Assert within floating-point tolerance
        expect(result).toBeCloseTo(expected, 6);
      }),
      { numRuns: 100 },
    );
  });
});
