import { db } from '../../db';
import { IWatchlistRepository, WatchlistEntry } from './watchlist.repository';

export class PostgresWatchlistRepository implements IWatchlistRepository {
  async add(userId: string, ticker: string): Promise<WatchlistEntry> {
    const now = new Date().toISOString();
    const query = `
      INSERT INTO watchlists (user_id, ticker_symbol, added_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await db.query(query, [userId, ticker, now]);
    return {
      userId: result.rows[0].user_id,
      tickerSymbol: result.rows[0].ticker_symbol,
      addedAt: result.rows[0].added_at,
    };
  }

  async remove(userId: string, ticker: string): Promise<boolean> {
    const query = `DELETE FROM watchlists WHERE user_id = $1 AND ticker_symbol = $2 RETURNING *;`;
    const result = await db.query(query, [userId, ticker]);
    return (result.rowCount || 0) > 0;
  }

  async has(userId: string, ticker: string): Promise<boolean> {
    const query = `SELECT 1 FROM watchlists WHERE user_id = $1 AND ticker_symbol = $2;`;
    const result = await db.query(query, [userId, ticker]);
    return (result.rowCount || 0) > 0;
  }

  async getAll(userId: string): Promise<WatchlistEntry[]> {
    const query = `SELECT * FROM watchlists WHERE user_id = $1 ORDER BY added_at ASC;`;
    const result = await db.query(query, [userId]);
    return result.rows.map(row => ({
      userId: row.user_id,
      tickerSymbol: row.ticker_symbol,
      addedAt: row.added_at,
    }));
  }
}
