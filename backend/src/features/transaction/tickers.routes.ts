import { Router, Request, Response } from 'express';
import { isValidTicker } from './transaction.service';

// ────────────────────────────────────────────────────────────
// Factory to create router (for testing)
// ────────────────────────────────────────────────────────────

export function createTickersRouter(): Router {
  const router = Router();

  /**
   * GET /api/tickers/validate/:ticker
   *
   * Validate a ticker symbol against the known ticker database.
   * Returns { valid: boolean, ticker: string }
   *
   * Requirements: 6.2
   */
  router.get('/validate/:ticker', (req: Request, res: Response) => {
    const ticker = (req.params.ticker as string).toUpperCase();
    const valid = isValidTicker(ticker);

    res.status(200).json({
      ticker,
      valid,
    });
  });

  return router;
}

// Default export for convenience
export default createTickersRouter();
