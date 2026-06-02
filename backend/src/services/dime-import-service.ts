import {
  StructuredTransaction,
  ImportParseResult,
  ImportError,
  DuplicateCheckResult,
  Transaction,
} from '../types';
import { ITransactionRepository, CreateTransactionDTO } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Import Result
// ────────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
  overwritten: number;
  errors: ImportError[];
}

// ────────────────────────────────────────────────────────────
// CSV Constants
// ────────────────────────────────────────────────────────────

const EXPECTED_CSV_HEADERS = ['ticker', 'date', 'price', 'shares', 'total'];

// ────────────────────────────────────────────────────────────
// Dime Import Service
// ────────────────────────────────────────────────────────────

export class DimeImportService {
  constructor(
    private readonly repository: ITransactionRepository,
    private readonly userId: string = 'default-user',
  ) {}

  /**
   * Parse a file buffer from Dime app in CSV or JSON format.
   * CSV format expects columns: ticker, date, price, shares, total
   * JSON format expects an array of objects with the same fields.
   *
   * Requirements: 13.1, 13.2, 13.5
   */
  parseFile(fileBuffer: Buffer, format: 'csv' | 'json'): ImportParseResult {
    if (format === 'csv') {
      return this.parseCSV(fileBuffer);
    } else if (format === 'json') {
      return this.parseJSON(fileBuffer);
    }

    return {
      transactions: [],
      errors: [{ row: 0, message: `Unsupported format: ${format}` }],
      totalRows: 0,
      successfulRows: 0,
    };
  }

  /**
   * Detect duplicate transactions by matching on ticker + date + price + shares.
   * Compares imported transactions against existing ones in the repository.
   *
   * Requirements: 13.6
   */
  async detectDuplicates(transactions: StructuredTransaction[]): Promise<DuplicateCheckResult> {
    const duplicates: DuplicateCheckResult['duplicates'] = [];
    const unique: StructuredTransaction[] = [];

    // Get all existing transactions for the user's tickers
    const tickerSet = new Set(transactions.map((t) => t.ticker));
    const existingByTicker = new Map<string, Transaction[]>();

    for (const ticker of tickerSet) {
      const existing = await this.repository.findByUserAndTicker(this.userId, ticker);
      existingByTicker.set(ticker, existing);
    }

    for (const imported of transactions) {
      const existingForTicker = existingByTicker.get(imported.ticker) ?? [];
      const match = existingForTicker.find(
        (existing) =>
          existing.tickerSymbol === imported.ticker &&
          existing.transactionDate === imported.date &&
          existing.pricePerShare === imported.price_per_share &&
          existing.shares === imported.shares,
      );

      if (match) {
        duplicates.push({ imported, existing: match });
      } else {
        unique.push(imported);
      }
    }

    return { duplicates, unique };
  }

  /**
   * Import transactions into the repository with duplicate handling.
   * If overwriteDuplicates is true, duplicate transactions are updated.
   * If false, duplicates are skipped.
   *
   * Requirements: 13.4, 13.6
   */
  async importTransactions(
    transactions: StructuredTransaction[],
    overwriteDuplicates: boolean,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      overwritten: 0,
      errors: [],
    };

    const { duplicates, unique } = await this.detectDuplicates(transactions);

    // Import unique transactions
    for (let i = 0; i < unique.length; i++) {
      const txn = unique[i];
      try {
        const dto: CreateTransactionDTO = {
          userId: this.userId,
          tickerSymbol: txn.ticker,
          transactionDate: txn.date,
          pricePerShare: txn.price_per_share,
          shares: txn.shares,
          totalAmount: txn.total_amount,
          source: 'dime_import',
        };
        await this.repository.create(dto);
        result.imported++;
      } catch (error) {
        result.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          rawData: txn,
        });
      }
    }

    // Handle duplicates
    for (const { imported, existing } of duplicates) {
      if (overwriteDuplicates) {
        try {
          await this.repository.update(existing.id, {
            tickerSymbol: imported.ticker,
            transactionDate: imported.date,
            pricePerShare: imported.price_per_share,
            shares: imported.shares,
            totalAmount: imported.total_amount,
            source: 'dime_import',
          });
          result.overwritten++;
        } catch (error) {
          result.errors.push({
            row: 0,
            message: error instanceof Error ? error.message : 'Unknown error during overwrite',
            rawData: imported,
          });
        }
      } else {
        result.skipped++;
      }
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────

  private parseCSV(fileBuffer: Buffer): ImportParseResult {
    const content = fileBuffer.toString('utf-8').trim();
    if (!content) {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'File is empty' }],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    const lines = content.split(/\r?\n/);
    if (lines.length < 2) {
      return {
        transactions: [],
        errors: [],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    // Validate headers
    const headerLine = lines[0].trim().toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim());
    const hasValidHeaders = EXPECTED_CSV_HEADERS.every((expected) => headers.includes(expected));

    if (!hasValidHeaders) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            message: `Invalid CSV headers. Expected: ${EXPECTED_CSV_HEADERS.join(', ')}. Got: ${headers.join(', ')}`,
          },
        ],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    // Map header positions
    const tickerIdx = headers.indexOf('ticker');
    const dateIdx = headers.indexOf('date');
    const priceIdx = headers.indexOf('price');
    const sharesIdx = headers.indexOf('shares');
    const totalIdx = headers.indexOf('total');

    const dataLines = lines.slice(1);
    const transactions: StructuredTransaction[] = [];
    const errors: ImportError[] = [];
    const totalRows = dataLines.filter((l) => l.trim().length > 0).length;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      const fields = parseCsvLine(line);
      const rowNum = i + 2; // 1-indexed, accounting for header

      try {
        const ticker = fields[tickerIdx]?.trim();
        const date = fields[dateIdx]?.trim();
        const priceStr = fields[priceIdx]?.trim();
        const sharesStr = fields[sharesIdx]?.trim();
        const totalStr = fields[totalIdx]?.trim();

        if (!ticker || !date || !priceStr || !sharesStr || !totalStr) {
          errors.push({ row: rowNum, message: 'Missing required fields', rawData: line });
          continue;
        }

        const price_per_share = parseFloat(priceStr);
        const shares = parseFloat(sharesStr);
        const total_amount = parseFloat(totalStr);

        if (isNaN(price_per_share) || isNaN(shares) || isNaN(total_amount)) {
          errors.push({ row: rowNum, message: 'Invalid numeric values', rawData: line });
          continue;
        }

        if (price_per_share <= 0 || shares <= 0 || total_amount <= 0) {
          errors.push({
            row: rowNum,
            message: 'Numeric values must be positive',
            rawData: line,
          });
          continue;
        }

        if (!isValidDate(date)) {
          errors.push({ row: rowNum, message: `Invalid date format: ${date}`, rawData: line });
          continue;
        }

        transactions.push({ ticker: ticker.toUpperCase(), date, price_per_share, shares, total_amount });
      } catch (error) {
        errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Parse error',
          rawData: line,
        });
      }
    }

    return {
      transactions,
      errors,
      totalRows,
      successfulRows: transactions.length,
    };
  }

  private parseJSON(fileBuffer: Buffer): ImportParseResult {
    const content = fileBuffer.toString('utf-8').trim();
    if (!content) {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'File is empty' }],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'Invalid JSON format' }],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    if (!Array.isArray(parsed)) {
      return {
        transactions: [],
        errors: [{ row: 0, message: 'JSON must be an array of transaction objects' }],
        totalRows: 0,
        successfulRows: 0,
      };
    }

    const transactions: StructuredTransaction[] = [];
    const errors: ImportError[] = [];
    const totalRows = parsed.length;

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const rowNum = i + 1;

      try {
        if (!item || typeof item !== 'object') {
          errors.push({ row: rowNum, message: 'Row is not an object', rawData: item });
          continue;
        }

        const obj = item as Record<string, unknown>;
        const ticker = typeof obj.ticker === 'string' ? obj.ticker.trim() : undefined;
        const date = typeof obj.date === 'string' ? obj.date.trim() : undefined;
        const price = typeof obj.price === 'number' ? obj.price : parseFloat(String(obj.price ?? ''));
        const shares = typeof obj.shares === 'number' ? obj.shares : parseFloat(String(obj.shares ?? ''));
        const total = typeof obj.total === 'number' ? obj.total : parseFloat(String(obj.total ?? ''));

        if (!ticker || !date) {
          errors.push({ row: rowNum, message: 'Missing required fields (ticker, date)', rawData: item });
          continue;
        }

        if (isNaN(price) || isNaN(shares) || isNaN(total)) {
          errors.push({ row: rowNum, message: 'Invalid numeric values', rawData: item });
          continue;
        }

        if (price <= 0 || shares <= 0 || total <= 0) {
          errors.push({ row: rowNum, message: 'Numeric values must be positive', rawData: item });
          continue;
        }

        if (!isValidDate(date)) {
          errors.push({ row: rowNum, message: `Invalid date format: ${date}`, rawData: item });
          continue;
        }

        transactions.push({
          ticker: ticker.toUpperCase(),
          date,
          price_per_share: price,
          shares,
          total_amount: total,
        });
      } catch (error) {
        errors.push({
          row: rowNum,
          message: error instanceof Error ? error.message : 'Parse error',
          rawData: item,
        });
      }
    }

    return {
      transactions,
      errors,
      totalRows,
      successfulRows: transactions.length,
    };
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Validate that a date string is in ISO 8601 format (YYYY-MM-DD).
 */
function isValidDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}
