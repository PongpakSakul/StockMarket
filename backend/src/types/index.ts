// ============================================================
// Core Type Aliases
// ============================================================

/** Supported time range options for chart and performance queries */
export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

/** Source of a transaction record */
export type TransactionSource = 'manual' | 'ocr' | 'dime_import';

/** Supported export file formats */
export type ExportFormat = 'csv' | 'xlsx';

// ============================================================
// Transaction Types
// ============================================================

/** A persisted buy transaction record */
export interface Transaction {
  id: string;
  userId: string;
  tickerSymbol: string;
  /** ISO 8601 date string (YYYY-MM-DD) */
  transactionDate: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  source: TransactionSource;
  slipImageUrl?: string;
  ocrRawText?: string;
  createdAt: string;
  updatedAt: string;
}

/** Structured transaction extracted from a Dime slip or import file */
export interface StructuredTransaction {
  ticker: string;
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: string;
  price_per_share: number;
  shares: number;
  total_amount: number;
}

// ============================================================
// Chart Types
// ============================================================

/** Aggregated buy point for display on a price chart */
export interface BuyPoint {
  date: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
  /** Number of transactions on this date */
  transactionCount: number;
}

/** Stock/ETF metadata */
export interface StockInfo {
  ticker: string;
  name: string;
  type: 'stock' | 'etf';
  exchange: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  marketCap?: number;
}

/** Ticker search autocomplete result */
export interface TickerSearchResult {
  ticker: string;
  name: string;
  type: 'stock' | 'etf';
  exchange: string;
}

/** OHLC candlestick data point */
export interface OHLCData {
  /** ISO 8601 date/time string */
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================
// Portfolio Types
// ============================================================

/** Full portfolio summary including holdings and exchange rate */
export interface PortfolioSummary {
  totalValueUSD: number;
  totalValueTHB: number;
  totalCostBasis: number;
  unrealizedPLUSD: number;
  unrealizedPLTHB: number;
  unrealizedPLPercent: number;
  totalDividendsReceived: number;
  totalReturnUSD: number;
  totalReturnPercent: number;
  dividendYieldPercent: number;
  exchangeRate: ExchangeRate;
  holdings: Holding[];
}

/** A single holding within the portfolio */
export interface Holding {
  tickerSymbol: string;
  tickerName: string;
  totalShares: number;
  averageCostBasis: number;
  currentPrice: number;
  currentValueUSD: number;
  unrealizedPLUSD: number;
  unrealizedPLPercent: number;
  allocationPercent: number;
  totalDividends: number;
  totalReturnUSD: number;
  totalReturnPercent: number;
}

/** Asset allocation entry for pie chart display */
export interface AssetAllocation {
  tickerSymbol: string;
  tickerName: string;
  valueUSD: number;
  percentage: number;
}

// ============================================================
// Dividend Types
// ============================================================

/** A persisted dividend record */
export interface Dividend {
  id: string;
  userId: string;
  tickerSymbol: string;
  dividendDate: string;
  amountPerShare: number;
  totalAmount: number;
  sharesHeld: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Watchlist Types
// ============================================================

/** A watchlist entry with live price data */
export interface WatchlistItem {
  tickerSymbol: string;
  tickerName: string;
  currentPrice: number;
  priceChangeAmount: number;
  priceChangePercent: number;
  /** Recent closing prices for sparkline rendering */
  sparklineData: number[];
}

// ============================================================
// Exchange Rate Types
// ============================================================

/** Exchange rate data with staleness indicator */
export interface ExchangeRate {
  currencyPair: string;
  rate: number;
  fetchedAt: string;
  /** true when the rate comes from an expired cache entry */
  isStale: boolean;
}

// ============================================================
// OCR & Slip Parsing Types
// ============================================================

/** Result from the OCR service */
export interface OCRResult {
  text: string;
  confidence: number;
  success: boolean;
  error?: string;
}

/** Result from the slip parser with per-field confidence */
export interface ParseResult {
  ticker?: string;
  date?: string;
  pricePerShare?: number;
  shares?: number;
  totalAmount?: number;
  missingFields: string[];
  confidence: Record<string, number>;
}

// ============================================================
// Export Types
// ============================================================

/** Filters for data export operations */
export interface ExportFilters {
  format: ExportFormat;
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================================
// Import Types
// ============================================================

/** Error encountered while parsing a single row during import */
export interface ImportError {
  row: number;
  message: string;
  rawData?: unknown;
}

/** Result of parsing an import file (CSV/JSON from Dime) */
export interface ImportParseResult {
  transactions: StructuredTransaction[];
  errors: ImportError[];
  totalRows: number;
  successfulRows: number;
}

/** Result of checking imported transactions against existing records */
export interface DuplicateCheckResult {
  duplicates: Array<{
    imported: StructuredTransaction;
    existing: Transaction;
  }>;
  unique: StructuredTransaction[];
}

// ============================================================
// Filter Types
// ============================================================

/** Query filters for transaction listing */
export interface TransactionFilters {
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'date' | 'ticker' | 'amount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** Query filters for dividend listing */
export interface DividendFilters {
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

// ============================================================
// API Error Types
// ============================================================

/** Standard API error response shape */
export interface APIError {
  /** Machine-readable error code, e.g. "INVALID_TICKER", "OCR_FAILED" */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional debugging details */
  details?: unknown;
  /** Whether the client should retry the request */
  retryable: boolean;
}
