import { Router, Request, Response } from 'express';
import { ChartService, IFinancialApiClient } from './chart.service';
import { APIError, TimeRange, OHLCData, StockInfo, TickerSearchResult } from '../../types';
import { InMemoryCache, appCache } from '../../cache/in-memory-cache';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const VALID_TIME_RANGES: TimeRange[] = ['1W', '1M', '3M', '6M', '1Y', 'ALL'];

// ────────────────────────────────────────────────────────────
// Factory to create router with injected dependencies (for testing)
// ────────────────────────────────────────────────────────────

export interface StockRouterDeps {
  apiClient: IFinancialApiClient;
  cache?: InMemoryCache;
}

export function createStockRouter(deps: StockRouterDeps): Router {
  const cache = deps.cache ?? appCache;
  const chartService = new ChartService(deps.apiClient, cache);
  const router = Router();

  /**
   * GET /api/stocks/:ticker/prices?range={timeRange}
   *
   * Returns OHLC price data for a ticker within a time range.
   *
   * Query params:
   *   - range: TimeRange (1W, 1M, 3M, 6M, 1Y, ALL) — defaults to '1M'
   *
   * Requirements: 1.1, 1.5
   */
  router.get('/:ticker/prices', async (req: Request, res: Response) => {
    try {
      const ticker = (req.params.ticker as string).toUpperCase();

      if (!ticker || ticker.length === 0) {
        const apiError: APIError = {
          code: 'INVALID_TICKER',
          message: 'Ticker symbol is required',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      // Parse and validate range
      const rangeParam = req.query.range ? String(req.query.range) : '1M';
      if (!VALID_TIME_RANGES.includes(rangeParam as TimeRange)) {
        const apiError: APIError = {
          code: 'INVALID_RANGE',
          message: `Invalid time range. Must be one of: ${VALID_TIME_RANGES.join(', ')}`,
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }
      const range = rangeParam as TimeRange;

      const prices = await chartService.getStockPrices(ticker, range);
      res.status(200).json(prices);
    } catch (err) {
      const apiError: APIError = {
        code: 'API_UNAVAILABLE',
        message: 'Unable to fetch stock price data. Please try again later.',
        retryable: true,
      };
      res.status(503).json(apiError);
    }
  });

  /**
   * GET /api/stocks/:ticker/info
   *
   * Returns stock/ETF metadata for a ticker.
   *
   * Requirements: 1.1
   */
  router.get('/:ticker/info', async (req: Request, res: Response) => {
    try {
      const ticker = (req.params.ticker as string).toUpperCase();

      if (!ticker || ticker.length === 0) {
        const apiError: APIError = {
          code: 'INVALID_TICKER',
          message: 'Ticker symbol is required',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const info = await chartService.getStockInfo(ticker);
      res.status(200).json(info);
    } catch (err) {
      const apiError: APIError = {
        code: 'API_UNAVAILABLE',
        message: 'Unable to fetch stock info. Please try again later.',
        retryable: true,
      };
      res.status(503).json(apiError);
    }
  });

  /**
   * GET /api/stocks/search?q={query}
   *
   * Search tickers with autocomplete.
   *
   * Query params:
   *   - q: search query string (required)
   *
   * Requirements: 1.1, 1.5
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q ? String(req.query.q).trim() : '';

      if (!query) {
        res.status(200).json([]);
        return;
      }

      const results = await chartService.searchTickers(query);
      res.status(200).json(results);
    } catch (err) {
      const apiError: APIError = {
        code: 'API_UNAVAILABLE',
        message: 'Unable to search tickers. Please try again later.',
        retryable: true,
      };
      res.status(503).json(apiError);
    }
  });

  return router;
}

// ────────────────────────────────────────────────────────────
// Stub IFinancialApiClient (for development/testing)
// Real API integration will come later.
// ────────────────────────────────────────────────────────────

export class StubFinancialApiClient implements IFinancialApiClient {
  async fetchPrices(ticker: string, range: TimeRange): Promise<OHLCData[]> {
    // Return a small set of sample OHLC data
    const now = new Date();
    const data: OHLCData[] = [];
    const days = this.getDaysForRange(range);

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const basePrice = 150 + Math.sin(i * 0.1) * 10;
      data.push({
        time: date.toISOString().split('T')[0],
        open: Math.round((basePrice - 1) * 100) / 100,
        high: Math.round((basePrice + 2) * 100) / 100,
        low: Math.round((basePrice - 2) * 100) / 100,
        close: Math.round(basePrice * 100) / 100,
        volume: Math.floor(1000000 + Math.random() * 5000000),
      });
    }

    return data;
  }

  async fetchStockInfo(ticker: string): Promise<StockInfo> {
    return {
      ticker,
      name: `${ticker} Inc.`,
      type: 'stock',
      exchange: 'NASDAQ',
      currency: 'USD',
      currentPrice: 150.25,
      previousClose: 149.80,
      marketCap: 2500000000000,
    };
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    // Return a few sample results matching the query
    const allTickers: TickerSearchResult[] = [
      { ticker: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', type: 'etf', exchange: 'NYSE' },
      { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'etf', exchange: 'NYSE' },
      { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', type: 'etf', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla Inc.', type: 'stock', exchange: 'NASDAQ' },
    ];

    const upperQuery = query.toUpperCase();
    return allTickers.filter(
      (t) =>
        t.ticker.includes(upperQuery) ||
        t.name.toUpperCase().includes(upperQuery),
    );
  }

  private getDaysForRange(range: TimeRange): number {
    switch (range) {
      case '1W': return 7;
      case '1M': return 30;
      case '3M': return 90;
      case '6M': return 180;
      case '1Y': return 365;
      case 'ALL': return 730;
      default: return 30;
    }
  }
}

// ────────────────────────────────────────────────────────────
// Default export — uses stub API client (for development)
// In production, wire a real API client in app.ts
// ────────────────────────────────────────────────────────────

export default createStockRouter({
  apiClient: new StubFinancialApiClient(),
});
