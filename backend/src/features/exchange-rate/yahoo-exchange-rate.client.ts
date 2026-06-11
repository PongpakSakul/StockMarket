import YahooFinanceType from 'yahoo-finance2';
import { IHttpClient } from './exchange-rate.service';

const yahooFinance = new (YahooFinanceType as any)();

export class YahooFinanceExchangeRateClient implements IHttpClient {
  async fetchRate(): Promise<{ rate: number; fetchedAt: string }> {
    try {
      // Yahoo Finance uses 'USDTHB=X' for the USD to THB exchange rate
      const quote: any = await yahooFinance.quote('USDTHB=X');
      
      if (!quote || !quote.regularMarketPrice) {
        throw new Error('Exchange rate not found or regularMarketPrice is missing.');
      }

      return {
        rate: quote.regularMarketPrice,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching exchange rate from Yahoo Finance:', error);
      throw error;
    }
  }
}
