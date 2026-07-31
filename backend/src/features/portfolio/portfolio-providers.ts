import { ITransactionProvider, IDividendProvider } from './portfolio.service';
import { Transaction } from '../../types';
import { db } from '../../db';

export class TransactionProviderAdapter implements ITransactionProvider {
  async getTransactionsForUser(userId: string): Promise<Transaction[]> {
    const result = await db.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);
    return result.rows.map(this.mapToTransaction);
  }

  async getTransactionsByTicker(userId: string, ticker: string): Promise<Transaction[]> {
    const result = await db.query('SELECT * FROM transactions WHERE user_id = $1 AND ticker_symbol = $2', [userId, ticker]);
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

export class DividendProviderAdapter implements IDividendProvider {
  async getTotalDividendsForUser(userId: string): Promise<number> {
    const result = await db.query('SELECT SUM(total_amount) as total FROM dividends WHERE user_id = $1', [userId]);
    return Number(result.rows[0].total) || 0;
  }

  async getDividendsByTicker(userId: string, ticker: string): Promise<number> {
    const result = await db.query('SELECT SUM(total_amount) as total FROM dividends WHERE user_id = $1 AND ticker_symbol = $2', [userId, ticker]);
    return Number(result.rows[0].total) || 0;
  }

  async getAnnualDividends(userId: string): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const result = await db.query('SELECT SUM(total_amount) as total FROM dividends WHERE user_id = $1 AND dividend_date >= $2', [userId, oneYearAgo.toISOString().split('T')[0]]);
    return Number(result.rows[0].total) || 0;
  }
}
