// Feature: stock-portfolio-tracker, Property 14: USD to THB conversion = USD × rate

import fc from 'fast-check';
import { ExchangeRateService, IHttpClient, IFallbackRateStore } from './exchange-rate-service';
import { InMemoryCache } from '../cache/in-memory-cache';

describe('USD to THB Conversion (Property-Based)', () => {
  it('convertUSDToTHB(amount) equals amount × rate within ±0.01 tolerance', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate positive USD amounts (0.01 to 1,000,000)
        fc.integer({ min: 1, max: 100000000 }).map((n) => n / 100),
        // Generate positive exchange rates (e.g., 30 to 40 for USD/THB)
        fc.integer({ min: 3000, max: 4000 }).map((n) => n / 100),
        async (amountUSD, rate) => {
          // Create a mock HTTP client that returns the generated rate
          const mockHttpClient: IHttpClient = {
            fetchRate: async () => ({
              rate,
              fetchedAt: new Date().toISOString(),
            }),
          };

          // Create a mock fallback store (not needed for this test)
          const mockFallbackStore: IFallbackRateStore = {
            getLastKnownRate: async () => null,
            saveRate: async () => {},
          };

          // Use a fresh cache for each run
          const cache = new InMemoryCache();

          const service = new ExchangeRateService(mockHttpClient, cache, mockFallbackStore);

          // Execute conversion and verify
          const result = await service.convertUSDToTHB(amountUSD);
          const expected = amountUSD * rate;
          expect(Math.abs(result - expected)).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 100 },
    );
  });
});
