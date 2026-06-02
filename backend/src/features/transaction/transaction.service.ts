import { Transaction, BuyPoint, TransactionFilters } from '../../types';
import {
  ITransactionRepository,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  PaginatedResult,
} from './transaction.repository';
import { KNOWN_TICKER_LIST } from '../slips/slip-parser.service';

// ────────────────────────────────────────────────────────────
// Validation errors
// ────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ────────────────────────────────────────────────────────────
// Validation helpers
// ────────────────────────────────────────────────────────────

/**
 * Validate that a ticker symbol is in the known list.
 */
export function isValidTicker(ticker: string): boolean {
  return KNOWN_TICKER_LIST.includes(ticker.toUpperCase());
}

/**
 * Validate that a date string is a valid ISO 8601 date (YYYY-MM-DD)
 * and is not in the future.
 */
export function isValidTransactionDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return false;

  // Verify the parsed date matches the input (catches invalid dates like 2024-02-30)
  const [year, month, day] = dateStr.split('-').map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  // Must not be in the future (compare date-only, ignoring time)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateStr <= todayStr;
}

/**
 * Validate that a numeric value is positive (> 0).
 */
export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

// ────────────────────────────────────────────────────────────
// Transaction Service
// ────────────────────────────────────────────────────────────

export class TransactionService {
  constructor(private readonly repository: ITransactionRepository) {}

  /**
   * Validate all fields of a transaction input.
   * Throws ValidationError on the first invalid field.
   */
  private validateTransactionInput(data: {
    tickerSymbol: string;
    transactionDate: string;
    pricePerShare: number;
    shares: number;
    totalAmount: number;
  }): void {
    if (!isValidTicker(data.tickerSymbol)) {
      throw new ValidationError(
        'INVALID_TICKER',
        `Ticker symbol "${data.tickerSymbol}" is not a recognized stock or ETF`,
      );
    }

    if (!isValidTransactionDate(data.transactionDate)) {
      throw new ValidationError(
        'INVALID_DATE',
        `Transaction date "${data.transactionDate}" is invalid or in the future`,
      );
    }

    if (!isPositiveNumber(data.pricePerShare)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Price per share must be a positive number',
      );
    }

    if (!isPositiveNumber(data.shares)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Shares must be a positive number',
      );
    }

    if (!isPositiveNumber(data.totalAmount)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Total amount must be a positive number',
      );
    }
  }

  /**
   * Create a new transaction after validation.
   * Requirements: 6.1, 6.2
   */
  async createTransaction(dto: CreateTransactionDTO): Promise<Transaction> {
    this.validateTransactionInput({
      tickerSymbol: dto.tickerSymbol,
      transactionDate: dto.transactionDate,
      pricePerShare: dto.pricePerShare,
      shares: dto.shares,
      totalAmount: dto.totalAmount,
    });

    return this.repository.create(dto);
  }

  /**
   * Update an existing transaction. Only validates fields that are provided.
   * Requirements: 6.3
   */
  async updateTransaction(id: string, dto: UpdateTransactionDTO): Promise<Transaction> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ValidationError('NOT_FOUND', `Transaction with id "${id}" not found`);
    }

    // Build a merged view for validation
    const merged = {
      tickerSymbol: dto.tickerSymbol ?? existing.tickerSymbol,
      transactionDate: dto.transactionDate ?? existing.transactionDate,
      pricePerShare: dto.pricePerShare ?? existing.pricePerShare,
      shares: dto.shares ?? existing.shares,
      totalAmount: dto.totalAmount ?? existing.totalAmount,
    };

    this.validateTransactionInput(merged);

    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw new ValidationError('NOT_FOUND', `Transaction with id "${id}" not found`);
    }
    return updated;
  }

  /**
   * Delete a transaction by id.
   * Requirements: 6.4
   */
  async deleteTransaction(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new ValidationError('NOT_FOUND', `Transaction with id "${id}" not found`);
    }
  }

  /**
   * Get transactions with filtering, sorting, and pagination.
   * Requirements: 6.5, 6.6
   */
  async getTransactions(filters: TransactionFilters): Promise<PaginatedResult<Transaction>> {
    return this.repository.findAll(filters);
  }

  /**
   * Get buy points for a specific ticker, aggregated by date.
   *
   * Groups all transactions for the ticker by transactionDate, then for each
   * date computes:
   * - pricePerShare: weighted average (sum(totalAmount) / sum(shares))
   * - shares: total shares bought on that date
   * - totalAmount: total invested on that date
   * - transactionCount: number of transactions on that date
   *
   * Requirements: 2.5 (Property 4)
   */
  async getBuyPointsForTicker(ticker: string, userId?: string): Promise<BuyPoint[]> {
    // Fetch all transactions for this ticker (no pagination)
    const result = await this.repository.findAll({
      tickerSymbol: ticker,
      page: 1,
      pageSize: 100_000, // effectively no limit
      sortBy: 'date',
      sortOrder: 'asc',
    });

    const transactions = userId
      ? result.data.filter((t) => t.userId === userId)
      : result.data;

    // Group by date
    const grouped = new Map<
      string,
      { shares: number; totalAmount: number; count: number }
    >();

    for (const txn of transactions) {
      const existing = grouped.get(txn.transactionDate);
      if (existing) {
        existing.shares += txn.shares;
        existing.totalAmount += txn.totalAmount;
        existing.count += 1;
      } else {
        grouped.set(txn.transactionDate, {
          shares: txn.shares,
          totalAmount: txn.totalAmount,
          count: 1,
        });
      }
    }

    // Convert to BuyPoint array
    const buyPoints: BuyPoint[] = [];
    for (const [date, agg] of grouped) {
      buyPoints.push({
        date,
        pricePerShare: agg.shares > 0 ? agg.totalAmount / agg.shares : 0,
        shares: agg.shares,
        totalAmount: agg.totalAmount,
        transactionCount: agg.count,
      });
    }

    // Sort by date ascending
    buyPoints.sort((a, b) => a.date.localeCompare(b.date));

    return buyPoints;
  }
}
