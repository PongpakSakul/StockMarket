import { ParseResult, StructuredTransaction } from '../types';

/**
 * Known ticker symbols from the seed database.
 * The parser matches OCR text against these to identify the traded asset.
 */
const KNOWN_TICKERS: string[] = [
  // ETFs
  'VOO', 'QQQM', 'QQQ', 'VTI', 'SPY', 'IVV', 'VGT', 'SCHD', 'VT', 'ARKK',
  // Stocks
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'DIS', 'NFLX', 'AMD', 'INTC',
  'CRM', 'COST',
];

/**
 * Sort tickers longest-first so that e.g. "QQQM" is matched before "QQQ",
 * and "BRK.B" before "BRK".
 */
const TICKERS_BY_LENGTH = [...KNOWN_TICKERS].sort((a, b) => b.length - a.length);

// ────────────────────────────────────────────────────────────
// Date parsing helpers
// ────────────────────────────────────────────────────────────

interface DatePattern {
  regex: RegExp;
  /** Return [year, month, day] from the match groups */
  extract: (m: RegExpMatchArray) => [number, number, number];
}

const DATE_PATTERNS: DatePattern[] = [
  // YYYY-MM-DD  (ISO)
  {
    regex: /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
    extract: (m) => [Number(m[1]), Number(m[2]), Number(m[3])],
  },
  // MM/DD/YYYY  or  MM-DD-YYYY
  {
    regex: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/,
    extract: (m) => [Number(m[3]), Number(m[1]), Number(m[2])],
  },
  // DD-MM-YYYY  (handled by the same regex above — disambiguation below)
  // Month DD, YYYY  (e.g. "March 15, 2024" or "Mar 15, 2024")
  {
    regex: /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
    extract: (m) => [Number(m[3]), monthNameToNumber(m[1]), Number(m[2])],
  },
];

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function monthNameToNumber(name: string): number {
  return MONTH_MAP[name.toLowerCase()] ?? 0;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Validate that year/month/day form a real calendar date.
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Try to parse a date from OCR text. Returns ISO 8601 string or undefined.
 *
 * For the ambiguous MM/DD/YYYY vs DD/MM/YYYY pattern we attempt MM/DD/YYYY
 * first (US format, common on Dime slips). If the first number > 12 we
 * swap to DD/MM/YYYY.
 */
function parseDate(text: string): string | undefined {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    let [year, month, day] = pattern.extract(match);

    // Disambiguation for numeric MM/DD/YYYY vs DD/MM/YYYY
    if (pattern === DATE_PATTERNS[1]) {
      // If first number > 12 it can't be a month → treat as DD/MM/YYYY
      const first = Number(match[1]);
      const second = Number(match[2]);
      if (first > 12 && second <= 12) {
        // swap: first is day, second is month
        day = first;
        month = second;
      }
    }

    if (isValidDate(year, month, day)) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return undefined;
}

// ────────────────────────────────────────────────────────────
// Numeric extraction helpers
// ────────────────────────────────────────────────────────────

/**
 * Extract a price value from OCR text.
 * Looks for patterns like "$450.25", "450.25 USD", "Price: $450.25",
 * "Price per share: 450.25", etc.
 */
function parsePrice(text: string): number | undefined {
  // Pattern: explicit price label
  const labelPatterns = [
    /(?:price\s*(?:per\s*share)?|price\/share|unit\s*price)\s*[:=]?\s*\$?\s*([\d,]+\.?\d*)/i,
  ];

  for (const re of labelPatterns) {
    const m = text.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return roundTo(val, 2);
    }
  }

  // Pattern: $NNN.NN (currency prefix) — pick the first that isn't the total
  const dollarMatches = [...text.matchAll(/\$([\d,]+\.\d{2})\b/g)];
  if (dollarMatches.length > 0) {
    // If there are multiple dollar amounts, try to identify price vs total.
    // Price is typically smaller than total, or appears first.
    const values = dollarMatches.map((m) => parseFloat(m[1].replace(/,/g, '')));
    // Return the first value — heuristic: price appears before total on Dime slips
    if (values.length === 1) return roundTo(values[0], 2);
    // With multiple values, return the smaller one as price (total = price × shares)
    const sorted = [...values].sort((a, b) => a - b);
    return roundTo(sorted[0], 2);
  }

  // Pattern: NNN.NN USD
  const usdMatch = text.match(/([\d,]+\.\d{2})\s*USD/i);
  if (usdMatch) {
    const val = parseFloat(usdMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return roundTo(val, 2);
  }

  return undefined;
}

/**
 * Extract the number of shares from OCR text.
 * Looks for patterns like "1.123456 shares", "Shares: 1.123456", "Qty: 2.5"
 */
function parseShares(text: string): number | undefined {
  const patterns = [
    /(?:shares|qty|quantity)\s*[:=]?\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.\d+)\s*shares?\b/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return roundTo(val, 6);
    }
  }

  return undefined;
}

/**
 * Extract the total amount from OCR text.
 * Looks for patterns like "Total: $505.59", "Total Amount: 505.59",
 * "Amount: $505.59"
 */
function parseTotalAmount(text: string): number | undefined {
  const patterns = [
    /(?:total\s*(?:amount)?|amount|invested)\s*[:=]?\s*\$?\s*([\d,]+\.?\d*)/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) return roundTo(val, 2);
    }
  }

  // Fallback: if we found dollar amounts and one is clearly larger, use it as total
  const dollarMatches = [...text.matchAll(/\$([\d,]+\.\d{2})\b/g)];
  if (dollarMatches.length >= 2) {
    const values = dollarMatches.map((m) => parseFloat(m[1].replace(/,/g, '')));
    const sorted = [...values].sort((a, b) => a - b);
    return roundTo(sorted[sorted.length - 1], 2);
  }

  return undefined;
}

// ────────────────────────────────────────────────────────────
// Ticker extraction
// ────────────────────────────────────────────────────────────

/**
 * Find a known ticker symbol in the OCR text.
 * Uses word-boundary matching, longest-first to avoid partial matches.
 */
function parseTicker(text: string): string | undefined {
  for (const ticker of TICKERS_BY_LENGTH) {
    // Escape the dot in BRK.B for regex
    const escaped = ticker.replace(/\./g, '\\.');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(text)) {
      return ticker; // Return canonical casing
    }
  }
  return undefined;
}

// ────────────────────────────────────────────────────────────
// Rounding utility
// ────────────────────────────────────────────────────────────

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Parse OCR text from a Dime slip and extract transaction fields.
 *
 * Returns a ParseResult with extracted values, a list of missing fields,
 * and per-field confidence scores.
 *
 * Requirements: 3.3, 3.7, 4.1, 4.2, 4.3, 4.4
 */
export function parse(ocrText: string): ParseResult {
  const ticker = parseTicker(ocrText);
  const date = parseDate(ocrText);
  const pricePerShare = parsePrice(ocrText);
  const shares = parseShares(ocrText);
  const totalAmount = parseTotalAmount(ocrText);

  const missingFields: string[] = [];
  const confidence: Record<string, number> = {};

  if (ticker !== undefined) {
    confidence['ticker'] = 1.0; // Exact match against known list
  } else {
    missingFields.push('ticker');
  }

  if (date !== undefined) {
    confidence['date'] = 0.9; // Date parsing is reliable but format-dependent
  } else {
    missingFields.push('date');
  }

  if (pricePerShare !== undefined) {
    confidence['pricePerShare'] = 0.85;
  } else {
    missingFields.push('pricePerShare');
  }

  if (shares !== undefined) {
    confidence['shares'] = 0.85;
  } else {
    missingFields.push('shares');
  }

  if (totalAmount !== undefined) {
    confidence['totalAmount'] = 0.8;
  } else {
    missingFields.push('totalAmount');
  }

  return {
    ticker,
    date,
    pricePerShare,
    shares,
    totalAmount,
    missingFields,
    confidence,
  };
}

/**
 * Convert a ParseResult into a StructuredTransaction.
 *
 * Missing fields are filled with sensible defaults:
 * - ticker → "UNKNOWN"
 * - date → today's date in ISO 8601
 * - pricePerShare → 0
 * - shares → 0
 * - total_amount → pricePerShare × shares (or 0)
 *
 * Requirements: 4.4
 */
export function toStructuredTransaction(
  parseResult: ParseResult,
): StructuredTransaction {
  const ticker = parseResult.ticker ?? 'UNKNOWN';
  const date = parseResult.date ?? new Date().toISOString().slice(0, 10);
  const pricePerShare = parseResult.pricePerShare ?? 0;
  const shares = parseResult.shares ?? 0;
  const totalAmount =
    parseResult.totalAmount ?? roundTo(pricePerShare * shares, 2);

  return {
    ticker,
    date,
    price_per_share: pricePerShare,
    shares,
    total_amount: totalAmount,
  };
}

export const KNOWN_TICKER_LIST = KNOWN_TICKERS;
