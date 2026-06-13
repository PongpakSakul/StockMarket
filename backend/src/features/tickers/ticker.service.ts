import { db } from '../../db';
import { ChartService } from '../charts/chart.service';
import { ValidationError } from '../transaction/transaction.service';

/**
 * Ensures that a ticker exists in the database.
 * If it doesn't, it validates the ticker via Yahoo Finance and inserts it.
 * Throws a ValidationError if the ticker is invalid.
 */
export async function ensureTickerExists(tickerSymbol: string, chartService: ChartService): Promise<void> {
  const normalized = tickerSymbol.trim().toUpperCase();
  
  if (!normalized) {
    throw new ValidationError('INVALID_TICKER', 'Ticker symbol cannot be empty');
  }

  // 1. Check if it already exists in the database
  const res = await db.query('SELECT 1 FROM tickers WHERE symbol = $1', [normalized]);
  if ((res.rowCount || 0) > 0) {
    return; // Already exists, we're good
  }

  // 2. Not in DB, validate via Financial API
  let info;
  try {
    info = await chartService.getStockInfo(normalized);
  } catch {
    throw new ValidationError(
      'INVALID_TICKER',
      `Ticker symbol "${normalized}" is not a recognized stock or ETF`,
    );
  }

  // 3. Upsert into DB
  const query = `
    INSERT INTO tickers (symbol, name, type, exchange, is_active)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (symbol) DO NOTHING;
  `;
  
  const type = info.type === 'etf' ? 'etf' : 'stock';
  const exchange = info.exchange || 'Unknown';
  
  await db.query(query, [normalized, info.name || normalized, type, exchange]);
}
