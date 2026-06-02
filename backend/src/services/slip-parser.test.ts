import { parse, toStructuredTransaction, KNOWN_TICKER_LIST } from './slip-parser';

describe('SlipParser', () => {
  // ─────────────────────────────────────────────────────────
  // parse() — Ticker extraction (Req 4.1)
  // ─────────────────────────────────────────────────────────
  describe('ticker extraction', () => {
    it('should extract a known ETF ticker from OCR text', () => {
      const result = parse('Buy VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      expect(result.ticker).toBe('VOO');
      expect(result.confidence['ticker']).toBe(1.0);
    });

    it('should extract a known stock ticker', () => {
      const result = parse('Transaction: AAPL purchased on 2024-01-10');
      expect(result.ticker).toBe('AAPL');
    });

    it('should match QQQM before QQQ (longest-first)', () => {
      const result = parse('Bought QQQM at $180.50');
      expect(result.ticker).toBe('QQQM');
    });

    it('should match BRK.B with dot in ticker', () => {
      const result = parse('Purchase BRK.B 01/15/2024 $380.00');
      expect(result.ticker).toBe('BRK.B');
    });

    it('should be case-insensitive for ticker matching', () => {
      const result = parse('Bought voo at $450.25');
      expect(result.ticker).toBe('VOO');
    });

    it('should report missing ticker when none found', () => {
      const result = parse('Some random text without a ticker symbol 03/15/2024');
      expect(result.ticker).toBeUndefined();
      expect(result.missingFields).toContain('ticker');
    });

    it('should not match partial ticker inside a word', () => {
      const result = parse('REVOLUTION is not a ticker 03/15/2024');
      // "V" is a known ticker but should not match inside "REVOLUTION"
      // unless it appears as a standalone word
      expect(result.ticker).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Date extraction (Req 4.2)
  // ─────────────────────────────────────────────────────────
  describe('date extraction', () => {
    it('should parse MM/DD/YYYY format', () => {
      const result = parse('VOO 03/15/2024 $450.25');
      expect(result.date).toBe('2024-03-15');
    });

    it('should parse YYYY-MM-DD (ISO) format', () => {
      const result = parse('VOO 2024-03-15 $450.25');
      expect(result.date).toBe('2024-03-15');
    });

    it('should parse DD-MM-YYYY when first number > 12', () => {
      const result = parse('VOO 25-03-2024 $450.25');
      expect(result.date).toBe('2024-03-25');
    });

    it('should parse "Month DD, YYYY" format', () => {
      const result = parse('VOO March 15, 2024 $450.25');
      expect(result.date).toBe('2024-03-15');
    });

    it('should parse abbreviated month name', () => {
      const result = parse('VOO Jan 5, 2024 $450.25');
      expect(result.date).toBe('2024-01-05');
    });

    it('should convert date to ISO 8601 format', () => {
      const result = parse('AAPL 12/31/2023 $190.00');
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should report missing date when none found', () => {
      const result = parse('VOO $450.25 1.5 shares');
      expect(result.date).toBeUndefined();
      expect(result.missingFields).toContain('date');
    });

    it('should have confidence score for date', () => {
      const result = parse('VOO 03/15/2024 $450.25');
      expect(result.confidence['date']).toBeDefined();
      expect(result.confidence['date']).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Price extraction (Req 4.3)
  // ─────────────────────────────────────────────────────────
  describe('price extraction', () => {
    it('should extract price with dollar sign', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      expect(result.pricePerShare).toBe(450.25);
    });

    it('should extract price from "Price: $NNN.NN" label', () => {
      const result = parse('VOO 03/15/2024 Price: $450.25 Shares: 1.123456');
      expect(result.pricePerShare).toBe(450.25);
    });

    it('should extract price from "Price per share: NNN.NN" label', () => {
      const result = parse('VOO 03/15/2024 Price per share: 450.25 Shares: 1.123456');
      expect(result.pricePerShare).toBe(450.25);
    });

    it('should extract price with USD suffix', () => {
      const result = parse('VOO 03/15/2024 450.25 USD Shares: 1.123456');
      expect(result.pricePerShare).toBe(450.25);
    });

    it('should round price to 2 decimal places', () => {
      const result = parse('VOO 03/15/2024 Price: $450.256 Shares: 1.123456');
      expect(result.pricePerShare).toBe(450.26);
    });

    it('should report missing price when none found', () => {
      const result = parse('VOO 03/15/2024 1.5 shares');
      expect(result.pricePerShare).toBeUndefined();
      expect(result.missingFields).toContain('pricePerShare');
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Shares extraction (Req 4.3)
  // ─────────────────────────────────────────────────────────
  describe('shares extraction', () => {
    it('should extract shares from "N.NNNNNN shares" pattern', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      expect(result.shares).toBe(1.123456);
    });

    it('should extract shares from "Shares: N.NNNNNN" label', () => {
      const result = parse('VOO 03/15/2024 $450.25 Shares: 1.123456');
      expect(result.shares).toBe(1.123456);
    });

    it('should extract shares from "Qty: N" label', () => {
      const result = parse('VOO 03/15/2024 $450.25 Qty: 2.5');
      expect(result.shares).toBe(2.5);
    });

    it('should round shares to 6 decimal places', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.1234567 shares');
      expect(result.shares).toBe(1.123457);
    });

    it('should report missing shares when none found', () => {
      const result = parse('VOO 03/15/2024 $450.25');
      expect(result.shares).toBeUndefined();
      expect(result.missingFields).toContain('shares');
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Total amount extraction
  // ─────────────────────────────────────────────────────────
  describe('total amount extraction', () => {
    it('should extract total from "Total: $NNN.NN" label', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      expect(result.totalAmount).toBe(505.59);
    });

    it('should extract total from "Amount: $NNN.NN" label', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Amount: $505.59');
      expect(result.totalAmount).toBe(505.59);
    });

    it('should report missing total when none found', () => {
      const result = parse('VOO 03/15/2024 Shares: 1.5');
      expect(result.totalAmount).toBeUndefined();
      expect(result.missingFields).toContain('totalAmount');
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Missing fields (Req 3.7)
  // ─────────────────────────────────────────────────────────
  describe('missing fields reporting', () => {
    it('should report all fields missing for empty text', () => {
      const result = parse('');
      expect(result.missingFields).toEqual(
        expect.arrayContaining(['ticker', 'date', 'pricePerShare', 'shares', 'totalAmount']),
      );
      expect(result.missingFields).toHaveLength(5);
    });

    it('should report no missing fields when all data is present', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      expect(result.missingFields).toHaveLength(0);
    });

    it('should report only the fields that are actually missing', () => {
      const result = parse('VOO 03/15/2024');
      expect(result.missingFields).not.toContain('ticker');
      expect(result.missingFields).not.toContain('date');
      expect(result.missingFields).toContain('pricePerShare');
      expect(result.missingFields).toContain('shares');
      expect(result.missingFields).toContain('totalAmount');
    });
  });

  // ─────────────────────────────────────────────────────────
  // parse() — Full slip text (integration-style)
  // ─────────────────────────────────────────────────────────
  describe('full slip parsing', () => {
    it('should parse a complete Dime slip OCR text', () => {
      const ocrText = `
        Dime - Investment Receipt
        Buy VOO
        Date: 03/15/2024
        Price per share: $450.25
        Shares: 1.123456
        Total: $505.59
      `;
      const result = parse(ocrText);

      expect(result.ticker).toBe('VOO');
      expect(result.date).toBe('2024-03-15');
      expect(result.pricePerShare).toBe(450.25);
      expect(result.shares).toBe(1.123456);
      expect(result.totalAmount).toBe(505.59);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should handle a slip with partial data', () => {
      const ocrText = `
        Dime - Investment Receipt
        Buy AAPL
        Date: 2024-01-10
        [image corrupted]
      `;
      const result = parse(ocrText);

      expect(result.ticker).toBe('AAPL');
      expect(result.date).toBe('2024-01-10');
      expect(result.pricePerShare).toBeUndefined();
      expect(result.shares).toBeUndefined();
      expect(result.missingFields).toContain('pricePerShare');
      expect(result.missingFields).toContain('shares');
    });
  });

  // ─────────────────────────────────────────────────────────
  // toStructuredTransaction() (Req 4.4)
  // ─────────────────────────────────────────────────────────
  describe('toStructuredTransaction', () => {
    it('should convert a complete ParseResult to StructuredTransaction', () => {
      const parseResult = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');
      const txn = toStructuredTransaction(parseResult);

      expect(txn).toEqual({
        ticker: 'VOO',
        date: '2024-03-15',
        price_per_share: 450.25,
        shares: 1.123456,
        total_amount: 505.59,
      });
    });

    it('should use defaults for missing fields', () => {
      const parseResult = parse('');
      const txn = toStructuredTransaction(parseResult);

      expect(txn.ticker).toBe('UNKNOWN');
      expect(txn.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(txn.price_per_share).toBe(0);
      expect(txn.shares).toBe(0);
      expect(txn.total_amount).toBe(0);
    });

    it('should compute total_amount from price × shares when total is missing', () => {
      const parseResult = parse('VOO 03/15/2024 $450.25 2.0 shares');
      const txn = toStructuredTransaction(parseResult);

      expect(txn.total_amount).toBe(900.50);
    });

    it('should produce a valid StructuredTransaction shape', () => {
      const parseResult = parse('MSFT 2024-06-01 Price: $420.50 Shares: 2.5 Total: $1051.25');
      const txn = toStructuredTransaction(parseResult);

      expect(txn).toHaveProperty('ticker');
      expect(txn).toHaveProperty('date');
      expect(txn).toHaveProperty('price_per_share');
      expect(txn).toHaveProperty('shares');
      expect(txn).toHaveProperty('total_amount');
    });
  });

  // ─────────────────────────────────────────────────────────
  // Confidence scores
  // ─────────────────────────────────────────────────────────
  describe('confidence scores', () => {
    it('should provide confidence scores for all extracted fields', () => {
      const result = parse('VOO 03/15/2024 $450.25 1.123456 shares Total: $505.59');

      expect(result.confidence['ticker']).toBeDefined();
      expect(result.confidence['date']).toBeDefined();
      expect(result.confidence['pricePerShare']).toBeDefined();
      expect(result.confidence['shares']).toBeDefined();
      expect(result.confidence['totalAmount']).toBeDefined();
    });

    it('should not have confidence scores for missing fields', () => {
      const result = parse('');

      expect(result.confidence['ticker']).toBeUndefined();
      expect(result.confidence['date']).toBeUndefined();
      expect(result.confidence['pricePerShare']).toBeUndefined();
      expect(result.confidence['shares']).toBeUndefined();
      expect(result.confidence['totalAmount']).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // KNOWN_TICKER_LIST export
  // ─────────────────────────────────────────────────────────
  describe('KNOWN_TICKER_LIST', () => {
    it('should contain all seed tickers', () => {
      const expected = [
        'VOO', 'QQQM', 'QQQ', 'VTI', 'SPY', 'IVV', 'VGT', 'SCHD', 'VT', 'ARKK',
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
        'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'DIS', 'NFLX', 'AMD', 'INTC',
        'CRM', 'COST',
      ];
      for (const t of expected) {
        expect(KNOWN_TICKER_LIST).toContain(t);
      }
    });
  });
});
