import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import slipsRouter from './features/slips/slips.routes';
import transactionsRouter from './features/transaction/transaction.routes';
import tickersRouter from './features/transaction/tickers.routes';
import portfolioRouter from './features/portfolio/portfolio.routes';
import exchangeRateRouter from './features/exchange-rate/exchange-rate.routes';
import dividendsRouter from './features/dividends/dividends.routes';
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

// Routes
app.use('/api/slips', slipsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/tickers', tickersRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/exchange-rate', exchangeRateRouter);
app.use('/api/dividends', dividendsRouter);
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
