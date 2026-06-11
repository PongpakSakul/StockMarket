export interface WatchlistEntry {
  userId: string;
  tickerSymbol: string;
  addedAt: string;
}

export interface IWatchlistRepository {
  add(userId: string, ticker: string): Promise<WatchlistEntry>;
  remove(userId: string, ticker: string): Promise<boolean>;
  has(userId: string, ticker: string): Promise<boolean>;
  getAll(userId: string): Promise<WatchlistEntry[]>;
}
