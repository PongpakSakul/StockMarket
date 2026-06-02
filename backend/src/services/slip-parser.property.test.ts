// Feature: stock-portfolio-tracker, Property 2: Slip Parser extracts data from OCR text correctly

import * as fc from 'fast-check';
import { parse, toStructuredTransaction, KNOWN_TICKER_LIST } from './slip-parser';

/**
 * Property-Based Test for Slip Parser extraction.
 *
 * Generates synthetic OCR text strings containing known ticker, date, price,
 * and shares values formatted like Dime app slips, then asserts that the parser
 * correctly extracts each field.
 */
describe('SlipParser - Property-Based Tests', () => {
  // ────────────────────────────────────────────────────────────
  // Arbitraries (generators) for synthetic OCR text components
  // ────────────────────────────────────────────────────────────

  /** Pick a random known ticker */
  const tickerArb = fc.constantFrom(...KNOWN_TICKER_LIST);

  /** Generate a valid date (year 2020-2025, month 1-12, day 1-28 to avoid invalid dates) */
  const datePartsArb = fc.record({
    year: fc.integer({ min: 2020, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  });

  /** Generate a price value (positive, 2 decimal places) */
  const priceArb = fc.double({ min: 0.01, max: 99999.99, noNaN: true }).map(
    (v) => Math.round(v * 100) / 100,
  );

  /** Generate a shares value (positive, up to 6 decimal places) */
  const sharesArb = fc.double({ min: 0.000001, max: 99999.999999, noNaN: true }).map(
    (v) => Math.round(v * 1000000) / 1000000,
  );

  /** Format date as MM/DD/YYYY */
  function formatDateMMDDYYYY(year: number, month: number, day: number): string {
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${mm}/${dd}/${year}`;
  }

  /** Format date as YYYY-MM-DD (ISO) */
  function formatDateISO(year: number, month: number, day: number): string {
    const mm = month.toString().padStart(2, '0');
    const dd = day.toString().padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  /** Expected ISO date string */
  function expectedISO(year: number, month: number, day: number): string {
    return formatDateISO(year, month, day);
  }

  // ────────────────────────────────────────────────────────────
  // Property 2: Complete Dime slip OCR text extraction
  // ────────────────────────────────────────────────────────────

  describe('Property 2: Slip Parser extracts data from OCR text correctly', () => {
    it('should correctly extract ticker, date, price, and shares from synthetic Dime slip text (MM/DD/YYYY format)', () => {
      fc.assert(
        fc.property(
          tickerArb,
          datePartsArb,
          priceArb,
          sharesArb,
          (ticker, dateParts, price, shares) => {
            const { year, month, day } = dateParts;
            const dateStr = formatDateMMDDYYYY(year, month, day);
            const priceStr = price.toFixed(2);
            const sharesStr = shares.toFixed(6);
            const total = Math.round(price * shares * 100) / 100;
            const totalStr = total.toFixed(2);

            // Build a Dime-style OCR text
            const ocrText = `Dime - Investment Receipt\nBuy ${ticker}\nDate: ${dateStr}\nPrice per share: $${priceStr}\nShares: ${sharesStr}\nTotal: $${totalStr}`;

            const result = parse(ocrText);

            // Ticker matches embedded ticker
            expect(result.ticker).toBe(ticker);

            // Date is valid ISO 8601 (YYYY-MM-DD)
            expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(result.date).toBe(expectedISO(year, month, day));

            // Price has 2 decimal places
            expect(result.pricePerShare).toBeDefined();
            const priceDecimalPlaces = result.pricePerShare!.toFixed(2);
            expect(result.pricePerShare).toBe(parseFloat(priceDecimalPlaces));

            // Shares has up to 6 decimal places
            expect(result.shares).toBeDefined();
            const sharesDecimalPlaces = result.shares!.toFixed(6);
            expect(result.shares).toBe(parseFloat(sharesDecimalPlaces));

            // No missing fields when all data is present
            expect(result.missingFields).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly extract ticker, date, price, and shares from synthetic Dime slip text (ISO date format)', () => {
      fc.assert(
        fc.property(
          tickerArb,
          datePartsArb,
          priceArb,
          sharesArb,
          (ticker, dateParts, price, shares) => {
            const { year, month, day } = dateParts;
            const dateStr = formatDateISO(year, month, day);
            const priceStr = price.toFixed(2);
            const sharesStr = shares.toFixed(6);
            const total = Math.round(price * shares * 100) / 100;
            const totalStr = total.toFixed(2);

            // Build a Dime-style OCR text with ISO date
            const ocrText = `Dime - Investment Receipt\nBuy ${ticker}\n${dateStr}\nPrice: $${priceStr}\n${sharesStr} shares\nTotal: $${totalStr}`;

            const result = parse(ocrText);

            // Ticker matches embedded ticker
            expect(result.ticker).toBe(ticker);

            // Date is valid ISO 8601
            expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(result.date).toBe(expectedISO(year, month, day));

            // Price has exactly 2 decimal places
            expect(result.pricePerShare).toBeDefined();
            expect(result.pricePerShare).toBe(parseFloat(price.toFixed(2)));

            // Shares has exactly 6 decimal places
            expect(result.shares).toBeDefined();
            expect(result.shares).toBe(parseFloat(shares.toFixed(6)));

            // No missing fields
            expect(result.missingFields).toHaveLength(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly identify missing fields when OCR text has partial data', () => {
      fc.assert(
        fc.property(
          tickerArb,
          datePartsArb,
          fc.constantFrom('price', 'shares', 'both'),
          (ticker, dateParts, missingField) => {
            const { year, month, day } = dateParts;
            const dateStr = formatDateMMDDYYYY(year, month, day);

            // Build OCR text missing some fields
            let ocrText = `Dime - Investment Receipt\nBuy ${ticker}\nDate: ${dateStr}\n`;

            if (missingField === 'price') {
              ocrText += 'Shares: 1.500000\n';
            } else if (missingField === 'shares') {
              ocrText += 'Price per share: $100.00\n';
            }
            // 'both' — neither price nor shares included

            const result = parse(ocrText);

            // Ticker and date should still be extracted
            expect(result.ticker).toBe(ticker);
            expect(result.date).toBe(expectedISO(year, month, day));

            // Missing fields are correctly identified
            if (missingField === 'price' || missingField === 'both') {
              expect(result.missingFields).toContain('pricePerShare');
            }
            if (missingField === 'shares' || missingField === 'both') {
              expect(result.missingFields).toContain('shares');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce a valid StructuredTransaction from parsed OCR text', () => {
      // Use price and shares ranges that produce a meaningful total (> 0.01)
      const meaningfulPriceArb = fc.double({ min: 1.0, max: 9999.99, noNaN: true }).map(
        (v) => Math.round(v * 100) / 100,
      );
      const meaningfulSharesArb = fc.double({ min: 0.01, max: 999.999999, noNaN: true }).map(
        (v) => Math.round(v * 1000000) / 1000000,
      );

      fc.assert(
        fc.property(
          tickerArb,
          datePartsArb,
          meaningfulPriceArb,
          meaningfulSharesArb,
          (ticker, dateParts, price, shares) => {
            const { year, month, day } = dateParts;
            const dateStr = formatDateMMDDYYYY(year, month, day);
            const priceStr = price.toFixed(2);
            const sharesStr = shares.toFixed(6);
            const total = Math.round(price * shares * 100) / 100;
            const totalStr = total.toFixed(2);

            const ocrText = `Buy ${ticker}\nDate: ${dateStr}\nPrice per share: $${priceStr}\nShares: ${sharesStr}\nTotal: $${totalStr}`;

            const parseResult = parse(ocrText);
            const txn = toStructuredTransaction(parseResult);

            // Structured transaction has all required fields
            expect(txn.ticker).toBe(ticker);
            expect(txn.date).toBe(expectedISO(year, month, day));
            expect(txn.price_per_share).toBe(parseFloat(priceStr));
            expect(txn.shares).toBe(parseFloat(sharesStr));
            expect(txn.total_amount).toBe(parseFloat(totalStr));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return ticker as undefined and include it in missingFields when OCR text has no known ticker', () => {
      fc.assert(
        fc.property(
          datePartsArb,
          priceArb,
          sharesArb,
          (dateParts, price, shares) => {
            const { year, month, day } = dateParts;
            const dateStr = formatDateMMDDYYYY(year, month, day);
            const priceStr = price.toFixed(2);
            const sharesStr = shares.toFixed(6);

            // OCR text without any known ticker
            const ocrText = `Dime - Investment Receipt\nBuy XYZNOTICKER\nDate: ${dateStr}\nPrice per share: $${priceStr}\nShares: ${sharesStr}`;

            const result = parse(ocrText);

            expect(result.ticker).toBeUndefined();
            expect(result.missingFields).toContain('ticker');

            // Other fields should still be extracted
            expect(result.date).toBe(expectedISO(year, month, day));
            expect(result.pricePerShare).toBe(parseFloat(priceStr));
            expect(result.shares).toBe(parseFloat(sharesStr));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
