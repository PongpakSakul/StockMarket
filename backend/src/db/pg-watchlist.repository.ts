import { Pool } from 'pg';

/**
 * Watchlist item as stored in PostgreSQL.
 */
export interface WatchlistRecord {
  id: string;
  userId: string;
  tickerSymbol: string;
  sortOrder: number;
  createdAt: string;
}

export interface IWatchlistRepository {
  add(userId: string, ticker: string): Promise<WatchlistRecord>;
  remove(userId: string, ticker: string): Promise<boolean>;
  findAll(userId: string): Promise<WatchlistRecord[]>;
  exists(userId: string, ticker: string): Promise<boolean>;
}

/**
 * PostgreSQL implementation of IWatchlistRepository.
 */
export class PgWatchlistRepository implements IWatchlistRepository {
  constructor(private pool: Pool) {}

  async add(userId: string, ticker: string): Promise<WatchlistRecord> {
    // Get next sort order
    const orderResult = await this.pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM watchlist_items WHERE user_id = $1',
      [userId]
    );
    const nextOrder = orderResult.rows[0].next_order;

    const result = await this.pool.query(
      `INSERT INTO watchlist_items (user_id, ticker_symbol, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, ticker_symbol) DO NOTHING
       RETURNING *`,
      [userId, ticker, nextOrder]
    );

    if (result.rows.length === 0) {
      // Already exists — fetch existing
      const existing = await this.pool.query(
        'SELECT * FROM watchlist_items WHERE user_id = $1 AND ticker_symbol = $2',
        [userId, ticker]
      );
      return this.mapRow(existing.rows[0]);
    }

    return this.mapRow(result.rows[0]);
  }

  async remove(userId: string, ticker: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM watchlist_items WHERE user_id = $1 AND ticker_symbol = $2',
      [userId, ticker]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAll(userId: string): Promise<WatchlistRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM watchlist_items WHERE user_id = $1 ORDER BY sort_order ASC',
      [userId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async exists(userId: string, ticker: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM watchlist_items WHERE user_id = $1 AND ticker_symbol = $2',
      [userId, ticker]
    );
    return result.rows.length > 0;
  }

  private mapRow(row: any): WatchlistRecord {
    return {
      id: row.id,
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      sortOrder: row.sort_order,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  }
}
