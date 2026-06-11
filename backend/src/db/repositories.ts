/**
 * Repository factory.
 *
 * When DATABASE_URL is set, returns PostgreSQL-backed repositories.
 * Otherwise, falls back to InMemory repositories (for testing / local dev without Docker).
 */

import { getPool } from './pool';
import { ITransactionRepository, InMemoryTransactionRepository } from '../features/transaction/transaction.repository';
import { IDividendRepository, InMemoryDividendRepository } from '../features/dividends/dividends.repository';
import { PgTransactionRepository } from './pg-transaction.repository';
import { PgDividendRepository } from './pg-dividend.repository';
import { PgWatchlistRepository, IWatchlistRepository } from './pg-watchlist.repository';

// In-memory watchlist (for fallback)
class InMemoryWatchlistRepository implements IWatchlistRepository {
  private store: Map<string, { id: string; userId: string; tickerSymbol: string; sortOrder: number; createdAt: string }> = new Map();
  private nextId = 1;

  async add(userId: string, ticker: string) {
    const key = `${userId}:${ticker}`;
    if (this.store.has(key)) return this.store.get(key)!;
    const record = { id: `wl-${this.nextId++}`, userId, tickerSymbol: ticker, sortOrder: this.store.size, createdAt: new Date().toISOString() };
    this.store.set(key, record);
    return record;
  }

  async remove(userId: string, ticker: string) {
    return this.store.delete(`${userId}:${ticker}`);
  }

  async findAll(userId: string) {
    return Array.from(this.store.values()).filter((r) => r.userId === userId);
  }

  async exists(userId: string, ticker: string) {
    return this.store.has(`${userId}:${ticker}`);
  }
}

// ────────────────────────────────────────────────────────────

export interface Repositories {
  transactions: ITransactionRepository;
  dividends: IDividendRepository;
  watchlist: IWatchlistRepository;
}

let _repos: Repositories | null = null;

/**
 * Get or create the application repositories.
 * Uses PostgreSQL if DATABASE_URL is available, otherwise in-memory.
 */
export function getRepositories(): Repositories {
  if (_repos) return _repos;

  const pool = getPool();

  if (pool) {
    console.log('[Repos] Using PostgreSQL repositories');
    _repos = {
      transactions: new PgTransactionRepository(pool),
      dividends: new PgDividendRepository(pool),
      watchlist: new PgWatchlistRepository(pool),
    };
  } else {
    console.log('[Repos] Using InMemory repositories (data will not persist across restarts)');
    _repos = {
      transactions: new InMemoryTransactionRepository(),
      dividends: new InMemoryDividendRepository(),
      watchlist: new InMemoryWatchlistRepository(),
    };
  }

  return _repos;
}
