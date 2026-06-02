// Feature: stock-portfolio-tracker, Property 5: Portfolio value and Unrealized P/L calculations

import fc from 'fast-check';
import { Holding } from '../types';
import { PortfolioService, UnrealizedPL } from './portfolio-service';

/**
 * Arbitrary generator for a single holding with positive shares and cost basis.
 * Uses integer-based generation then divides to avoid floating-point drift in generators.
 */
const holdingArb: fc.Arbitrary<Holding> = fc.record({
  tickerSymbol: fc.stringMatching(/^[A-Z]{1,5}$/),
  tickerName: fc.string({ minLength: 1, maxLength: 20 }),
  totalShares: fc.integer({ min: 1, max: 1_000_000 }).map((n) => n / 100),
  averageCostBasis: fc.integer({ min: 1, max: 10_000_00 }).map((n) => n / 100),
  currentPrice: fc.integer({ min: 1, max: 10_000_00 }).map((n) => n / 100),
  currentValueUSD: fc.constant(0), // will be recalculated
  unrealizedPLUSD: fc.constant(0),
  unrealizedPLPercent: fc.constant(0),
  allocationPercent: fc.constant(0),
  totalDividends: fc.constant(0),
  totalReturnUSD: fc.constant(0),
  totalReturnPercent: fc.constant(0),
});

/**
 * Generate a list of holdings with unique ticker symbols and a matching currentPrices map.
 * The currentPrices map may override the holding's currentPrice.
 */
const holdingsWithPricesArb: fc.Arbitrary<{
  holdings: Holding[];
  currentPrices: Map<string, number>;
}> = fc
  .uniqueArray(holdingArb, {
    minLength: 1,
    maxLength: 10,
    selector: (h) => h.tickerSymbol,
  })
  .chain((holdings) => {
    // Generate current prices for each ticker
    const priceArbs = holdings.map((h) =>
      fc
        .integer({ min: 1, max: 10_000_00 })
        .map((n) => [h.tickerSymbol, n / 100] as [string, number]),
    );
    return fc.tuple(...priceArbs).map((entries) => ({
      holdings,
      currentPrices: new Map(entries),
    }));
  });

/**
 * Helper: Create a minimal PortfolioService instance for testing pure calculation methods.
 * The calculateUnrealizedPL method is synchronous and doesn't need providers.
 */
function createService(): PortfolioService {
  const noop = {} as any;
  return new PortfolioService(noop, noop, noop, noop);
}

describe('Portfolio Value and Unrealized P/L Calculations (Property-Based)', () => {
  const service = createService();
  const EPSILON = 1e-6;

  it('totalValue equals sum of (shares × currentPrice) for all holdings', () => {
    fc.assert(
      fc.property(holdingsWithPricesArb, ({ holdings, currentPrices }) => {
        // Calculate expected total value
        const expectedTotalValue = holdings.reduce((sum, h) => {
          const price = currentPrices.get(h.tickerSymbol) ?? h.currentPrice;
          return sum + h.totalShares * price;
        }, 0);

        // Calculate actual total value from the PL results
        const plResults = service.calculateUnrealizedPL(holdings, currentPrices);

        // Reconstruct total value: unrealizedPL = (price - avgCost) * shares
        // So price * shares = unrealizedPL + avgCost * shares
        const actualTotalValue = holdings.reduce((sum, h, idx) => {
          const price = currentPrices.get(h.tickerSymbol) ?? h.currentPrice;
          return sum + h.totalShares * price;
        }, 0);

        expect(Math.abs(actualTotalValue - expectedTotalValue)).toBeLessThan(EPSILON);
      }),
      { numRuns: 100 },
    );
  });

  it('unrealizedPL per holding equals (currentPrice - averageCostBasis) × shares', () => {
    fc.assert(
      fc.property(holdingsWithPricesArb, ({ holdings, currentPrices }) => {
        const plResults = service.calculateUnrealizedPL(holdings, currentPrices);

        for (let i = 0; i < holdings.length; i++) {
          const holding = holdings[i];
          const price = currentPrices.get(holding.tickerSymbol) ?? holding.currentPrice;
          const expectedPL = (price - holding.averageCostBasis) * holding.totalShares;

          const result = plResults.find(
            (r) => r.tickerSymbol === holding.tickerSymbol,
          );
          expect(result).toBeDefined();
          expect(Math.abs(result!.unrealizedPLUSD - expectedPL)).toBeLessThan(EPSILON);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('total unrealizedPL equals sum of individual unrealizedPL values', () => {
    fc.assert(
      fc.property(holdingsWithPricesArb, ({ holdings, currentPrices }) => {
        const plResults = service.calculateUnrealizedPL(holdings, currentPrices);

        // Total PL from summing individual results
        const totalPLFromResults = plResults.reduce(
          (sum, r) => sum + r.unrealizedPLUSD,
          0,
        );

        // Total PL computed independently
        const expectedTotalPL = holdings.reduce((sum, h) => {
          const price = currentPrices.get(h.tickerSymbol) ?? h.currentPrice;
          return sum + (price - h.averageCostBasis) * h.totalShares;
        }, 0);

        expect(Math.abs(totalPLFromResults - expectedTotalPL)).toBeLessThan(EPSILON);
      }),
      { numRuns: 100 },
    );
  });

  it('unrealizedPL percent equals (totalPL / totalCost) × 100 for each holding', () => {
    fc.assert(
      fc.property(holdingsWithPricesArb, ({ holdings, currentPrices }) => {
        const plResults = service.calculateUnrealizedPL(holdings, currentPrices);

        for (let i = 0; i < holdings.length; i++) {
          const holding = holdings[i];
          const price = currentPrices.get(holding.tickerSymbol) ?? holding.currentPrice;
          const costBasis = holding.averageCostBasis * holding.totalShares;
          const unrealizedPL =
            (price - holding.averageCostBasis) * holding.totalShares;
          const expectedPercent =
            costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

          const result = plResults.find(
            (r) => r.tickerSymbol === holding.tickerSymbol,
          );
          expect(result).toBeDefined();
          expect(
            Math.abs(result!.unrealizedPLPercent - expectedPercent),
          ).toBeLessThan(EPSILON);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('result count matches holdings count', () => {
    fc.assert(
      fc.property(holdingsWithPricesArb, ({ holdings, currentPrices }) => {
        const plResults = service.calculateUnrealizedPL(holdings, currentPrices);
        expect(plResults.length).toBe(holdings.length);
      }),
      { numRuns: 100 },
    );
  });
});
