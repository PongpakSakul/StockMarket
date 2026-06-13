import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { getRepositories } from './db/repositories';
import { TransactionService } from './features/transaction/transaction.service';
import { DividendService } from './features/dividends/dividends.service';
import { createTransactionsRouter } from './features/transaction/transaction.routes';
import { createDividendsRouter } from './features/dividends/dividends.routes';
import slipsRouter from './features/slips/slips.routes';
import tickersRouter from './features/transaction/tickers.routes';
import portfolioRouter from './features/portfolio/portfolio.routes';
import exchangeRateRouter from './features/exchange-rate/exchange-rate.routes';
import exportRouter from './features/export/export.routes';
import importRouter from './features/import/import.routes';
import stocksRouter from './features/charts/stock.routes';
import watchlistRouter from './features/watch-list/watchlist.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Wire repositories & services ──
const repos = getRepositories();

import { YahooFinanceClient } from './features/charts/yahoo-finance.client';
import { ChartService } from './features/charts/chart.service';
import { appCache } from './cache/in-memory-cache';

const apiClient = new YahooFinanceClient();
const chartService = new ChartService(apiClient, appCache);

const transactionService = new TransactionService(repos.transactions, chartService);
const dividendService = new DividendService(repos.dividends, repos.transactions, chartService);

// Routes (injected with real repositories)
app.use('/api/slips', slipsRouter);
app.use('/api/transactions', createTransactionsRouter({ service: transactionService }));
app.use('/api/tickers', tickersRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/exchange-rate', exchangeRateRouter);
app.use('/api/dividends', createDividendsRouter({ service: dividendService }));
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/watchlist', watchlistRouter);

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      retryable: true,
    });
  }
);

export default app;
