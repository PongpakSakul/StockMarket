import { Router, Request, Response } from 'express';
import { ChartService } from '../charts/chart.service';
import { YahooFinanceClient } from '../charts/yahoo-finance.client';
import { appCache } from '../../cache/in-memory-cache';

export interface TickersRouterDeps {
  chartService?: ChartService;
}

export function createTickersRouter(deps?: TickersRouterDeps): Router {
  const chartService = deps?.chartService ?? new ChartService(new YahooFinanceClient(), appCache);
  const router = Router();

  /**
   * GET /api/tickers/validate/:ticker
   *
   * Validate a ticker symbol against Yahoo Finance.
   * Returns { valid: boolean, ticker: string }
   */
  router.get('/validate/:ticker', async (req: Request, res: Response) => {
    const ticker = (req.params.ticker as string).toUpperCase();
    try {
      await chartService.getStockInfo(ticker);
      res.status(200).json({ ticker, valid: true });
    } catch {
      res.status(200).json({ ticker, valid: false });
    }
  });

  return router;
}

export default createTickersRouter();
