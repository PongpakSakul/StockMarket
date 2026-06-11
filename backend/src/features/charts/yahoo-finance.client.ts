import YahooFinanceType from 'yahoo-finance2';
const yahooFinance = new (YahooFinanceType as any)();
import { IFinancialApiClient } from './chart.service';
import { OHLCData, StockInfo, TickerSearchResult, TimeRange } from '../../types';

export class YahooFinanceClient implements IFinancialApiClient {
  async fetchPrices(ticker: string, range: TimeRange): Promise<OHLCData[]> {
    const period1 = this.getPeriod1ForRange(range);
    const interval = this.getIntervalForRange(range);
    
    try {
      const result: any = await yahooFinance.chart(ticker, {
        period1: period1,
        interval: interval as any,
      });
      
      if (!result || !result.quotes || result.quotes.length === 0) {
        return [];
      }
      
      return result.quotes.map((quote: any) => ({
        time: quote.date.toISOString().split('T')[0],
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        close: quote.close || 0,
        volume: quote.volume || 0,
      }));
    } catch (error) {
      console.error(`Error fetching prices for ${ticker}:`, error);
      throw error;
    }
  }

  async fetchStockInfo(ticker: string): Promise<StockInfo> {
    try {
      const quote: any = await yahooFinance.quote(ticker);
      
      if (!quote) {
        throw new Error(`Stock info not found for ticker: ${ticker}`);
      }
      
      const type = quote.quoteType === 'ETF' ? 'etf' : 'stock';
      
      return {
        ticker: quote.symbol,
        name: quote.longName || quote.shortName || ticker,
        type,
        exchange: quote.exchange || 'Unknown',
        currency: quote.currency || 'USD',
        currentPrice: quote.regularMarketPrice || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        marketCap: quote.marketCap,
      };
    } catch (error) {
      console.error(`Error fetching stock info for ${ticker}:`, error);
      throw error;
    }
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    try {
      const results: any = await yahooFinance.search(query);
      
      if (!results || !results.quotes) return [];
      
      return results.quotes
        .filter((q: any) => q.isYahooFinance)
        .map((q: any) => ({
          ticker: q.symbol,
          name: q.longname || q.shortname || q.symbol,
          type: q.quoteType === 'ETF' ? 'etf' : 'stock',
          exchange: q.exchDisp || q.exchange || 'Unknown'
        }));
    } catch (error) {
      console.error(`Error searching tickers for query "${query}":`, error);
      throw error;
    }
  }

  private getPeriod1ForRange(range: TimeRange): string {
    const d = new Date();
    switch (range) {
      case '1W': d.setDate(d.getDate() - 7); break;
      case '1M': d.setMonth(d.getMonth() - 1); break;
      case '3M': d.setMonth(d.getMonth() - 3); break;
      case '6M': d.setMonth(d.getMonth() - 6); break;
      case '1Y': d.setFullYear(d.getFullYear() - 1); break;
      case 'ALL': return '1970-01-01';
      default: d.setMonth(d.getMonth() - 1); break;
    }
    return d.toISOString().split('T')[0];
  }

  private getIntervalForRange(range: TimeRange): string {
    switch (range) {
      case '1W': return '15m';
      case '1M': return '1d';
      case '3M': return '1d';
      case '6M': return '1d';
      case '1Y': return '1d';
      case 'ALL': return '1wk';
      default: return '1d';
    }
  }
}
