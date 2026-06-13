import { db } from '../../db';
import { IWatchlistRepository, WatchlistEntry } from './watchlist.repository';

export class PostgresWatchlistRepository implements IWatchlistRepository {
  async add(userId: string, ticker: string): Promise<WatchlistEntry> {
    const query = `
      INSERT INTO watchlist_items (user_id, ticker_symbol)
      VALUES ($1, $2)
      RETURNING *;
    `;
    const result = await db.query(query, [userId, ticker]);
    return {
      userId: result.rows[0].user_id,
      tickerSymbol: result.rows[0].ticker_symbol,
      addedAt: result.rows[0].created_at,
    };
  }

  async remove(userId: string, ticker: string): Promise<boolean> {
    const query = `DELETE FROM watchlist_items WHERE user_id = $1 AND ticker_symbol = $2 RETURNING *;`;
    const result = await db.query(query, [userId, ticker]);
    return (result.rowCount || 0) > 0;
  }

  async has(userId: string, ticker: string): Promise<boolean> {
    const query = `SELECT 1 FROM watchlist_items WHERE user_id = $1 AND ticker_symbol = $2;`;
    const result = await db.query(query, [userId, ticker]);
    return (result.rowCount || 0) > 0;
  }

  async getAll(userId: string): Promise<WatchlistEntry[]> {
    const query = `SELECT * FROM watchlist_items WHERE user_id = $1 ORDER BY created_at ASC;`;
    const result = await db.query(query, [userId]);
    return result.rows.map(row => ({
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      addedAt: row.created_at,
    }));
  }
}
