import { Dividend, DividendFilters, Holding, TimeRange } from '../types';
import {
  IDividendRepository,
  CreateDividendDTO,
  UpdateDividendDTO,
  PaginatedResult,
} from '../repositories/dividend-repository';
import { ITransactionRepository } from '../repositories/transaction-repository';
import { IDividendProvider } from './portfolio-service';
import { ValidationError, isValidTicker, isValidTransactionDate, isPositiveNumber } from './transaction-service';

// ────────────────────────────────────────────────────────────
// Dividend Summary
// ────────────────────────────────────────────────────────────

export interface DividendSummary {
  totalAmount: number;
  count: number;
  fromDate: string;
  toDate: string;
}

// ────────────────────────────────────────────────────────────
// Time range helpers
// ────────────────────────────────────────────────────────────

function getDateRangeFromTimeRange(range: TimeRange): { fromDate: string; toDate: string } {
  const now = new Date();
  const toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let from: Date;
  switch (range) {
    case '1W':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1M':
      from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3M':
      from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6M':
      from = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1Y':
      from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'ALL':
      from = new Date(2000, 0, 1);
      break;
  }

  const fromDate = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return { fromDate, toDate };
}

// ────────────────────────────────────────────────────────────
// Dividend Service
// ────────────────────────────────────────────────────────────

export class DividendService implements IDividendProvider {
  constructor(
    private readonly repository: IDividendRepository,
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────────────────────

  private validateDividendInput(data: {
    tickerSymbol: string;
    dividendDate: string;
    amountPerShare: number;
    totalAmount: number;
    sharesHeld: number;
  }): void {
    if (!isValidTicker(data.tickerSymbol)) {
      throw new ValidationError(
        'INVALID_TICKER',
        `Ticker symbol "${data.tickerSymbol}" is not a recognized stock or ETF`,
      );
    }

    if (!isValidTransactionDate(data.dividendDate)) {
      throw new ValidationError(
        'INVALID_DATE',
        `Dividend date "${data.dividendDate}" is invalid or in the future`,
      );
    }

    if (!isPositiveNumber(data.amountPerShare)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Amount per share must be a positive number',
      );
    }

    if (!isPositiveNumber(data.totalAmount)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Total amount must be a positive number',
      );
    }

    if (!isPositiveNumber(data.sharesHeld)) {
      throw new ValidationError(
        'INVALID_AMOUNT',
        'Shares held must be a positive number',
      );
    }
  }

  /**
   * Validate that the user holds the given ticker on the specified date.
   * A user holds a ticker if they have at least one transaction for that ticker
   * with a transaction date on or before the dividend date.
   *
   * Requirements: 11.2
   * Property 15: Dividend Holding Validation
   */
  private async validateTickerHeldByUser(
    userId: string,
    tickerSymbol: string,
    dividendDate: string,
  ): Promise<void> {
    const transactions = await this.transactionRepository.findByUserAndTicker(userId, tickerSymbol);
    const heldOnDate = transactions.some((t) => t.transactionDate <= dividendDate);

    if (!heldOnDate) {
      throw new ValidationError(
        'TICKER_NOT_HELD',
        `User does not hold "${tickerSymbol}" on ${dividendDate}. You must have a buy transaction on or before the dividend date.`,
      );
    }
  }

  // ────────────────────────────────────────────────────────────
  // CRUD Operations
  // ────────────────────────────────────────────────────────────

  /**
   * Create a new dividend record after validation.
   * Requirements: 11.1, 11.2
   */
  async createDividend(dto: CreateDividendDTO): Promise<Dividend> {
    this.validateDividendInput({
      tickerSymbol: dto.tickerSymbol,
      dividendDate: dto.dividendDate,
      amountPerShare: dto.amountPerShare,
      totalAmount: dto.totalAmount,
      sharesHeld: dto.sharesHeld,
    });

    await this.validateTickerHeldByUser(dto.userId, dto.tickerSymbol, dto.dividendDate);

    return this.repository.create(dto);
  }

  /**
   * Update an existing dividend. Only validates fields that are provided.
   * Requirements: 11.1
   */
  async updateDividend(id: string, userId: string, dto: UpdateDividendDTO): Promise<Dividend> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }

    if (existing.userId !== userId) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }

    // Build a merged view for validation
    const merged = {
      tickerSymbol: dto.tickerSymbol ?? existing.tickerSymbol,
      dividendDate: dto.dividendDate ?? existing.dividendDate,
      amountPerShare: dto.amountPerShare ?? existing.amountPerShare,
      totalAmount: dto.totalAmount ?? existing.totalAmount,
      sharesHeld: dto.sharesHeld ?? existing.sharesHeld,
    };

    this.validateDividendInput(merged);

    // Re-validate holding if ticker or date changed
    if (dto.tickerSymbol !== undefined || dto.dividendDate !== undefined) {
      await this.validateTickerHeldByUser(userId, merged.tickerSymbol, merged.dividendDate);
    }

    const updated = await this.repository.update(id, dto);
    if (!updated) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }
    return updated;
  }

  /**
   * Delete a dividend by id.
   * Requirements: 11.1
   */
  async deleteDividend(id: string, userId: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }

    if (existing.userId !== userId) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new ValidationError('NOT_FOUND', `Dividend with id "${id}" not found`);
    }
  }

  /**
   * Get dividends with filtering and pagination.
   * Requirements: 11.4
   */
  async getDividends(userId: string, filters: DividendFilters): Promise<PaginatedResult<Dividend>> {
    return this.repository.findAll(userId, filters);
  }

  // ────────────────────────────────────────────────────────────
  // Summary & Calculations
  // ────────────────────────────────────────────────────────────

  /**
   * Get cumulative dividends in a time range.
   * Requirements: 11.6
   */
  async getDividendSummary(userId: string, range: TimeRange): Promise<DividendSummary> {
    const { fromDate, toDate } = getDateRangeFromTimeRange(range);

    const result = await this.repository.findAll(userId, {
      fromDate,
      toDate,
      page: 1,
      pageSize: 100_000, // effectively no limit
    });

    const totalAmount = result.data.reduce((sum, d) => sum + d.totalAmount, 0);

    return {
      totalAmount,
      count: result.data.length,
      fromDate,
      toDate,
    };
  }

  /**
   * Calculate dividend yield for the portfolio.
   * Dividend Yield = (annual dividends / portfolio value) × 100
   *
   * Requirements: 11.5
   * Property 16: Total Return & Dividend Yield
   */
  calculateDividendYield(holdings: Holding[], dividends: Dividend[]): number {
    const portfolioValue = holdings.reduce((sum, h) => sum + h.currentValueUSD, 0);

    if (portfolioValue === 0) return 0;

    // Calculate annual dividends (dividends from the last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;

    const annualDividends = dividends
      .filter((d) => d.dividendDate >= oneYearAgoStr)
      .reduce((sum, d) => sum + d.totalAmount, 0);

    return (annualDividends / portfolioValue) * 100;
  }

  // ────────────────────────────────────────────────────────────
  // IDividendProvider implementation
  // ────────────────────────────────────────────────────────────

  /**
   * Get total dividends received by a user (all time).
   */
  async getTotalDividendsForUser(userId: string): Promise<number> {
    const dividends = await this.repository.findByUser(userId);
    return dividends.reduce((sum, d) => sum + d.totalAmount, 0);
  }

  /**
   * Get total dividends for a specific ticker.
   */
  async getDividendsByTicker(userId: string, ticker: string): Promise<number> {
    const dividends = await this.repository.findByUserAndTicker(userId, ticker);
    return dividends.reduce((sum, d) => sum + d.totalAmount, 0);
  }

  /**
   * Get annual dividends (last 12 months) for a user.
   */
  async getAnnualDividends(userId: string): Promise<number> {
    const dividends = await this.repository.findByUser(userId);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;

    return dividends
      .filter((d) => d.dividendDate >= oneYearAgoStr)
      .reduce((sum, d) => sum + d.totalAmount, 0);
  }
}
