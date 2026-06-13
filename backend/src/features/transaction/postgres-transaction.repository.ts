import { db } from '../../db';
import { Transaction, TransactionFilters } from '../../types';
import { ITransactionRepository, CreateTransactionDTO, UpdateTransactionDTO, PaginatedResult } from './transaction.repository';
import crypto from 'crypto';

export class PostgresTransactionRepository implements ITransactionRepository {
  
  async create(dto: CreateTransactionDTO): Promise<Transaction> {
    const source = dto.source ?? 'manual';
    
    const query = `
      INSERT INTO transactions (
        user_id, ticker_symbol, transaction_date, price_per_share, shares, total_amount, source, slip_image_url, ocr_raw_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      dto.userId, dto.tickerSymbol, dto.transactionDate, dto.pricePerShare, dto.shares, dto.totalAmount,
      source, dto.slipImageUrl || null, dto.ocrRawText || null
    ];
    
    const result = await db.query(query, values);
    return this.mapToTransaction(result.rows[0]);
  }

  async update(id: string, dto: UpdateTransactionDTO): Promise<Transaction | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.tickerSymbol !== undefined) { updates.push(`ticker_symbol = $${idx++}`); values.push(dto.tickerSymbol); }
    if (dto.transactionDate !== undefined) { updates.push(`transaction_date = $${idx++}`); values.push(dto.transactionDate); }
    if (dto.pricePerShare !== undefined) { updates.push(`price_per_share = $${idx++}`); values.push(dto.pricePerShare); }
    if (dto.shares !== undefined) { updates.push(`shares = $${idx++}`); values.push(dto.shares); }
    if (dto.totalAmount !== undefined) { updates.push(`total_amount = $${idx++}`); values.push(dto.totalAmount); }
    if (dto.source !== undefined) { updates.push(`source = $${idx++}`); values.push(dto.source); }
    
    updates.push(`updated_at = $${idx++}`); values.push(now);
    values.push(id); // Where id = $last

    const query = `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *;`;
    const result = await db.query(query, values);
    
    return this.mapToTransaction(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM transactions WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    return (result.rowCount || 0) > 0;
  }

  async findById(id: string): Promise<Transaction | null> {
    const query = `SELECT * FROM transactions WHERE id = $1;`;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this.mapToTransaction(result.rows[0]);
  }

  async findAll(filters: TransactionFilters): Promise<PaginatedResult<Transaction>> {
    let whereClauses: string[] = [];
    let values: any[] = [];
    let idx = 1;

    if (filters.tickerSymbol) {
      whereClauses.push(`ticker_symbol = $${idx++}`);
      values.push(filters.tickerSymbol);
    }
    if (filters.fromDate) {
      whereClauses.push(`transaction_date >= $${idx++}`);
      values.push(filters.fromDate);
    }
    if (filters.toDate) {
      whereClauses.push(`transaction_date <= $${idx++}`);
      values.push(filters.toDate);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count Total
    const countQuery = `SELECT COUNT(*) FROM transactions ${whereStr};`;
    const countResult = await db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Sorting
    const sortByMap: Record<string, string> = {
      'date': 'transaction_date',
      'ticker': 'ticker_symbol',
      'amount': 'total_amount'
    };
    const sortField = sortByMap[filters.sortBy ?? 'date'] || 'transaction_date';
    const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Pagination
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT * FROM transactions 
      ${whereStr} 
      ORDER BY ${sortField} ${sortOrder} 
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataValues = [...values, pageSize, offset];
    const dataResult = await db.query(dataQuery, dataValues);

    const data = dataResult.rows.map(this.mapToTransaction);
    const totalPages = Math.ceil(total / pageSize);

    return { data, total, page, pageSize, totalPages };
  }

  async findByUserAndTicker(userId: string, ticker: string): Promise<Transaction[]> {
    const query = `SELECT * FROM transactions WHERE user_id = $1 AND ticker_symbol = $2 ORDER BY transaction_date ASC;`;
    const result = await db.query(query, [userId, ticker]);
    return result.rows.map(this.mapToTransaction);
  }

  private mapToTransaction(row: any): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      transactionDate: row.transaction_date,
      pricePerShare: Number(row.price_per_share),
      shares: Number(row.shares),
      totalAmount: Number(row.total_amount),
      source: row.source,
      slipImageUrl: row.slip_image_url || undefined,
      ocrRawText: row.ocr_raw_text || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
