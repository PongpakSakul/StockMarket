import { Pool } from 'pg';
import { Transaction, TransactionFilters } from '../types';
import {
  ITransactionRepository,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  PaginatedResult,
} from '../features/transaction/transaction.repository';

/**
 * PostgreSQL implementation of ITransactionRepository.
 * Persists transaction data to the PostgreSQL database.
 */
export class PgTransactionRepository implements ITransactionRepository {
  constructor(private pool: Pool) {}

  async create(dto: CreateTransactionDTO): Promise<Transaction> {
    const result = await this.pool.query(
      `INSERT INTO transactions (user_id, ticker_symbol, transaction_date, price_per_share, shares, total_amount, source, slip_image_url, ocr_raw_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dto.userId,
        dto.tickerSymbol,
        dto.transactionDate,
        dto.pricePerShare,
        dto.shares,
        dto.totalAmount,
        dto.source ?? 'manual',
        dto.slipImageUrl ?? null,
        dto.ocrRawText ? JSON.stringify(dto.ocrRawText) : null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, dto: UpdateTransactionDTO): Promise<Transaction | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.tickerSymbol !== undefined) { fields.push(`ticker_symbol = $${idx++}`); values.push(dto.tickerSymbol); }
    if (dto.transactionDate !== undefined) { fields.push(`transaction_date = $${idx++}`); values.push(dto.transactionDate); }
    if (dto.pricePerShare !== undefined) { fields.push(`price_per_share = $${idx++}`); values.push(dto.pricePerShare); }
    if (dto.shares !== undefined) { fields.push(`shares = $${idx++}`); values.push(dto.shares); }
    if (dto.totalAmount !== undefined) { fields.push(`total_amount = $${idx++}`); values.push(dto.totalAmount); }
    if (dto.source !== undefined) { fields.push(`source = $${idx++}`); values.push(dto.source); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<Transaction | null> {
    const result = await this.pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAll(filters: TransactionFilters): Promise<PaginatedResult<Transaction>> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.tickerSymbol) {
      conditions.push(`ticker_symbol = $${idx++}`);
      values.push(filters.tickerSymbol);
    }
    if (filters.fromDate) {
      conditions.push(`transaction_date >= $${idx++}`);
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push(`transaction_date <= $${idx++}`);
      values.push(filters.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM transactions ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Sort
    const sortBy = filters.sortBy ?? 'date';
    const sortOrder = filters.sortOrder ?? 'desc';
    const sortColumn = sortBy === 'date' ? 'transaction_date' : sortBy === 'ticker' ? 'ticker_symbol' : 'total_amount';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Paginate
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const dataResult = await this.pool.query(
      `SELECT * FROM transactions ${whereClause} ORDER BY ${sortColumn} ${orderDirection} LIMIT $${idx++} OFFSET $${idx}`,
      [...values, pageSize, offset]
    );

    const data = dataResult.rows.map((row) => this.mapRow(row));
    const totalPages = Math.ceil(total / pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  async findByUserAndTicker(userId: string, ticker: string): Promise<Transaction[]> {
    const result = await this.pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 AND ticker_symbol = $2 ORDER BY transaction_date ASC',
      [userId, ticker]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: any): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      transactionDate: row.transaction_date instanceof Date
        ? row.transaction_date.toISOString().slice(0, 10)
        : String(row.transaction_date),
      pricePerShare: parseFloat(row.price_per_share),
      shares: parseFloat(row.shares),
      totalAmount: parseFloat(row.total_amount),
      source: row.source,
      slipImageUrl: row.slip_image_url ?? undefined,
      ocrRawText: row.ocr_raw_text ?? undefined,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
