// Feature: stock-portfolio-tracker, Property 6: Asset allocation percentages sum to 100%

import fc from 'fast-check';
import { Holding } from '../types';
import { PortfolioService } from './portfolio-service';

/**
 * Creates a minimal PortfolioService instance for testing the pure
 * calculateAllocation method (no async dependencies needed).
 */
function createPortfolioService(): PortfolioService {
  const noop = {} as any;
  return new PortfolioService(noop, noop, noop, noop);
}

/**
 * Arbitrary generator for an array of holdings with positive values.
 * Generates 1-10 holdings with unique ticker symbols, each with positive
 * shares and positive price, resulting in positive currentValueUSD.
 */
const holdingsArb: fc.Arbitrary<Holding[]> = fc
  .integer({ min: 1, max: 10 })
  .chain((count) =>
    fc.tuple(
      fc.uniqueArray(fc.stringMatching(/^[A-Z]{1,5}$/), {
        minLength: count,
        maxLength: count,
      }),
      fc.array(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.integer({ min: 1, max: 100000 }).map((n) => n / 100),
          fc.integer({ min: 1, max: 999999 }).map((n) => n / 100),
          fc.integer({ min: 1, max: 999999 }).map((n) => n / 100),
          fc.integer({ min: 1, max: 99999999 }).map((n) => n / 100),
        ),
        { minLength: count, maxLength: count },
      ),
    ),
  )
  .map(([tickers, values]) =>
    tickers.map((ticker, i) => ({
      tickerSymbol: ticker,
      tickerName: values[i][0],
      totalShares: values[i][1],
      averageCostBasis: values[i][2],
      currentPrice: values[i][3],
      currentValueUSD: values[i][4],
      unrealizedPLUSD: 0,
      unrealizedPLPercent: 0,
      allocationPercent: 0,
      totalDividends: 0,
      totalReturnUSD: 0,
      totalReturnPercent: 0,
    })),
  );

describe('Asset Allocation Percentages Sum to 100% (Property-Based)', () => {
  const service = createPortfolioService();

  it('sum of allocation percentages equals 100% within ±0.01% tolerance', () => {
    fc.assert(
      fc.property(holdingsArb, (holdings) => {
        const allocations = service.calculateAllocation(holdings);

        // If all holdings have value, we should get allocations back
        expect(allocations.length).toBe(holdings.length);

        // Sum all percentages
        const sum = allocations.reduce((acc, a) => acc + a.percentage, 0);

        // Assert: sum equals 100% within ±0.01% tolerance
        expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
      }),
      { numRuns: 100 },
    );
  });

  it('each allocation percentage is non-negative and does not exceed 100%', () => {
    fc.assert(
      fc.property(holdingsArb, (holdings) => {
        const allocations = service.calculateAllocation(holdings);

        for (const allocation of allocations) {
          expect(allocation.percentage).toBeGreaterThanOrEqual(0);
          expect(allocation.percentage).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('allocation preserves ticker symbols and values from holdings', () => {
    fc.assert(
      fc.property(holdingsArb, (holdings) => {
        const allocations = service.calculateAllocation(holdings);

        // Each allocation should map to a holding
        for (const allocation of allocations) {
          const matching = holdings.find(
            (h) => h.tickerSymbol === allocation.tickerSymbol,
          );
          expect(matching).toBeDefined();
          expect(allocation.valueUSD).toBe(matching!.currentValueUSD);
        }
      }),
      { numRuns: 100 },
    );
  });
});
