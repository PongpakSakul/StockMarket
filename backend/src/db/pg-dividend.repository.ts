import { Pool } from 'pg';
import { Dividend, DividendFilters } from '../types';
import {
  IDividendRepository,
  CreateDividendDTO,
  UpdateDividendDTO,
  PaginatedResult,
} from '../features/dividends/dividends.repository';

/**
 * PostgreSQL implementation of IDividendRepository.
 * Persists dividend data to the PostgreSQL database.
 */
export class PgDividendRepository implements IDividendRepository {
  constructor(private pool: Pool) {}

  async create(dto: CreateDividendDTO): Promise<Dividend> {
    const result = await this.pool.query(
      `INSERT INTO dividends (user_id, ticker_symbol, dividend_date, amount_per_share, total_amount, shares_held)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [dto.userId, dto.tickerSymbol, dto.dividendDate, dto.amountPerShare, dto.totalAmount, dto.sharesHeld]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, dto: UpdateDividendDTO): Promise<Dividend | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.tickerSymbol !== undefined) { fields.push(`ticker_symbol = $${idx++}`); values.push(dto.tickerSymbol); }
    if (dto.dividendDate !== undefined) { fields.push(`dividend_date = $${idx++}`); values.push(dto.dividendDate); }
    if (dto.amountPerShare !== undefined) { fields.push(`amount_per_share = $${idx++}`); values.push(dto.amountPerShare); }
    if (dto.totalAmount !== undefined) { fields.push(`total_amount = $${idx++}`); values.push(dto.totalAmount); }
    if (dto.sharesHeld !== undefined) { fields.push(`shares_held = $${idx++}`); values.push(dto.sharesHeld); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.pool.query(
      `UPDATE dividends SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM dividends WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<Dividend | null> {
    const result = await this.pool.query('SELECT * FROM dividends WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findAll(userId: string, filters: DividendFilters): Promise<PaginatedResult<Dividend>> {
    const conditions: string[] = ['user_id = $1'];
    const values: any[] = [userId];
    let idx = 2;

    if (filters.tickerSymbol) {
      conditions.push(`ticker_symbol = $${idx++}`);
      values.push(filters.tickerSymbol);
    }
    if (filters.fromDate) {
      conditions.push(`dividend_date >= $${idx++}`);
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push(`dividend_date <= $${idx++}`);
      values.push(filters.toDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM dividends ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginate
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const dataResult = await this.pool.query(
      `SELECT * FROM dividends ${whereClause} ORDER BY dividend_date DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...values, pageSize, offset]
    );

    const data = dataResult.rows.map((row) => this.mapRow(row));
    const totalPages = Math.ceil(total / pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  async findByUser(userId: string): Promise<Dividend[]> {
    const result = await this.pool.query(
      'SELECT * FROM dividends WHERE user_id = $1 ORDER BY dividend_date DESC',
      [userId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async findByUserAndTicker(userId: string, ticker: string): Promise<Dividend[]> {
    const result = await this.pool.query(
      'SELECT * FROM dividends WHERE user_id = $1 AND ticker_symbol = $2 ORDER BY dividend_date DESC',
      [userId, ticker]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: any): Dividend {
    return {
      id: row.id,
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      dividendDate: row.dividend_date instanceof Date
        ? row.dividend_date.toISOString().slice(0, 10)
        : String(row.dividend_date),
      amountPerShare: parseFloat(row.amount_per_share),
      totalAmount: parseFloat(row.total_amount),
      sharesHeld: parseFloat(row.shares_held),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
