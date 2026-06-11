import { db } from '../../db';
import { ExchangeRate } from '../../types';
import { IFallbackRateStore } from './exchange-rate.service';

export class PostgresFallbackRateStore implements IFallbackRateStore {
  async getLastKnownRate(): Promise<ExchangeRate | null> {
    const query = `SELECT rate, fetched_at FROM exchange_rates WHERE currency_pair = $1;`;
    const result = await db.query(query, ['USD/THB']);
    
    if (result.rows.length === 0) {
      return null;
    }

    return {
      currencyPair: 'USD/THB',
      rate: Number(result.rows[0].rate),
      fetchedAt: result.rows[0].fetched_at,
      isStale: true, // Typically loaded from DB implies fallback usage
    };
  }

  async saveRate(rate: ExchangeRate): Promise<void> {
    // Upsert the rate
    const query = `
      INSERT INTO exchange_rates (currency_pair, rate, fetched_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (currency_pair) DO UPDATE 
      SET rate = EXCLUDED.rate, fetched_at = EXCLUDED.fetched_at;
    `;
    await db.query(query, [rate.currencyPair, rate.rate, rate.fetchedAt]);
  }
}
