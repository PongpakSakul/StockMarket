import { IPriceProvider } from './portfolio.service';
import { ChartService } from '../charts/chart.service';
import { TimeRange } from '../../types';

export class ChartPriceProvider implements IPriceProvider {
  constructor(private readonly chartService: ChartService) {}

  async getCurrentPrices(tickers: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    // Fetch all stock prices in parallel
    const promises = tickers.map(async (ticker) => {
      try {
        const ohlcData = await this.chartService.getStockPrices(ticker, '1W');
        if (ohlcData && ohlcData.length > 0) {
          prices.set(ticker, ohlcData[ohlcData.length - 1].close);
        } else {
          prices.set(ticker, 0);
        }
      } catch (err) {
        console.error(`Failed to fetch current price for ${ticker}:`, err);
        prices.set(ticker, 0); // Fallback to 0 if failed
      }
    });

    await Promise.all(promises);
    return prices;
  }

  async getTickerName(ticker: string): Promise<string> {
    try {
      const info = await this.chartService.getStockInfo(ticker);
      return info.name || ticker;
    } catch (err) {
      console.error(`Failed to fetch name for ${ticker}:`, err);
      return ticker;
    }
  }

  async getHistoricalPrices(ticker: string, range: TimeRange): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    try {
      const ohlcData = await this.chartService.getStockPrices(ticker, range);
      for (const data of ohlcData) {
        prices.set(data.time, data.close);
      }
    } catch (err) {
      console.error(`Failed to fetch historical prices for ${ticker}:`, err);
    }

    return prices;
  }
}
