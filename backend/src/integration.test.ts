import request from 'supertest';
import express from 'express';
import { createTransactionsRouter } from './routes/transactions';
import { createPortfolioRouter, PortfolioRouterDeps } from './routes/portfolio';
import { createDividendsRouter } from './routes/dividends';
import { createExportRouter } from './routes/export';
import { createImportRouter } from './routes/import';
import { TransactionService } from './services/transaction-service';
import { InMemoryTransactionRepository } from './repositories/transaction-repository';
import { InMemoryDividendRepository } from './repositories/dividend-repository';
import { DividendService } from './services/dividend-service';
import { ExportService, RepositoryTransactionProvider } from './services/export-service';
import { DimeImportService } from './services/dime-import-service';
import {
  PortfolioService,
  ITransactionProvider,
  IPriceProvider,
  IExchangeRateProvider,
  IDividendProvider,
} from './services/portfolio-service';
import { InMemoryCache } from './cache/in-memory-cache';
import { Transaction, ExchangeRate, TimeRange } from './types';
import * as ocrService from './services/ocr-service';
import { OCRResult } from './types';

// Mock the OCR service
jest.mock('./services/ocr-service');
const mockExtractText = ocrService.extractText as jest.MockedFunction<typeof ocrService.extractText>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const TEST_USER_ID = 'integration-test-user';

function makePngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}

// ────────────────────────────────────────────────────────────
// Flow 1: Slip Upload → OCR → Parse → Save → Verify
// ────────────────────────────────────────────────────────────

describe('Integration Flow 1: Slip Upload → OCR → Parse → Save', () => {
  let app: express.Express;
  let transactionRepo: InMemoryTransactionRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    transactionRepo = new InMemoryTransactionRepository();
    const txnService = new TransactionService(transactionRepo);
    const cache = new InMemoryCache();

    app = express();
    app.use(express.json());

    // Use the default slips router (uses global app import for OCR mock)
    // Instead, we mount transactions router with shared repo
    app.use('/api/transactions', createTransactionsRouter({ service: txnService, cache }));
  });

  it('should upload slip, get parsed transaction, then save and verify it exists', async () => {
    // Step 1: Mock OCR response with a complete Dime slip text
    const ocrText = 'Buy AAPL\nDate: 2024-06-15\nPrice per share: $185.50\nShares: 10.000000\nTotal: $1855.00';
    mockExtractText.mockResolvedValue({
      text: ocrText,
      confidence: 0.95,
      success: true,
    });

    // Use the default app for slip upload (the mock is applied globally)
    const appImport = (await import('./app')).default;

    // Step 1: Upload slip
    const uploadRes = await request(appImport)
      .post('/api/slips/upload')
      .attach('slip', makePngBuffer(), { filename: 'slip.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.transaction).toBeDefined();
    expect(uploadRes.body.transaction.ticker).toBe('AAPL');
    expect(uploadRes.body.transaction.date).toBe('2024-06-15');
    expect(uploadRes.body.transaction.price_per_share).toBe(185.5);
    expect(uploadRes.body.transaction.shares).toBe(10);

    // Step 2: Save parsed transaction via the transaction API
    const parsedTxn = uploadRes.body.transaction;

    const saveRes = await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: parsedTxn.ticker,
        transactionDate: parsedTxn.date,
        pricePerShare: parsedTxn.price_per_share,
        shares: parsedTxn.shares,
        totalAmount: parsedTxn.total_amount,
        source: 'ocr',
      });

    expect(saveRes.status).toBe(201);
    expect(saveRes.body.tickerSymbol).toBe('AAPL');
    expect(saveRes.body.source).toBe('ocr');

    // Step 3: Verify transaction appears in list
    const listRes = await request(app)
      .get('/api/transactions')
      .set('x-user-id', TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    const found = listRes.body.data.find(
      (t: Transaction) => t.tickerSymbol === 'AAPL' && t.transactionDate === '2024-06-15',
    );
    expect(found).toBeDefined();
    expect(found.pricePerShare).toBe(185.5);
  });
});

// ────────────────────────────────────────────────────────────
// Flow 2: Manual Transaction CRUD → Portfolio Recalculation
// ────────────────────────────────────────────────────────────

describe('Integration Flow 2: Manual Transaction CRUD → Portfolio Recalculation', () => {
  let app: express.Express;
  let transactionRepo: InMemoryTransactionRepository;

  beforeEach(() => {
    transactionRepo = new InMemoryTransactionRepository();
    const txnService = new TransactionService(transactionRepo);
    const cache = new InMemoryCache();

    // Create providers for portfolio service that read from the same repo
    const transactionProvider: ITransactionProvider = {
      getTransactionsForUser: async (userId: string) => {
        const result = await transactionRepo.findAll({ page: 1, pageSize: 100000 });
        return result.data.filter((t) => t.userId === userId);
      },
      getTransactionsByTicker: async (userId: string, ticker: string) => {
        return transactionRepo.findByUserAndTicker(userId, ticker);
      },
    };

    const priceProvider: IPriceProvider = {
      getCurrentPrices: async (tickers: string[]) => {
        const prices = new Map<string, number>();
        // Simulate prices for known tickers
        for (const ticker of tickers) {
          if (ticker === 'AAPL') prices.set(ticker, 200);
          else if (ticker === 'VOO') prices.set(ticker, 450);
          else prices.set(ticker, 100);
        }
        return prices;
      },
      getTickerName: async (ticker: string) => ticker,
      getHistoricalPrices: async () => new Map(),
    };

    const exchangeRateProvider: IExchangeRateProvider = {
      getCurrentRate: async (): Promise<ExchangeRate> => ({
        currencyPair: 'USD/THB',
        rate: 35.0,
        fetchedAt: new Date().toISOString(),
        isStale: false,
      }),
    };

    const dividendProvider: IDividendProvider = {
      getTotalDividendsForUser: async () => 0,
      getDividendsByTicker: async () => 0,
      getAnnualDividends: async () => 0,
    };

    const portfolioDeps: PortfolioRouterDeps = {
      transactionProvider,
      priceProvider,
      exchangeRateProvider,
      dividendProvider,
      cache,
    };

    app = express();
    app.use(express.json());
    app.use('/api/transactions', createTransactionsRouter({ service: txnService, cache }));
    app.use('/api/portfolio', createPortfolioRouter(portfolioDeps));
  });

  it('should create, update, and delete transactions with portfolio reflecting changes', async () => {
    // Step 1: Create a transaction
    const createRes = await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185.50,
        shares: 10,
        totalAmount: 1855.00,
      });

    expect(createRes.status).toBe(201);
    const txnId = createRes.body.id;

    // Step 2: Get portfolio summary — should reflect the holding
    const summaryRes1 = await request(app)
      .get('/api/portfolio/summary')
      .set('x-user-id', TEST_USER_ID);

    expect(summaryRes1.status).toBe(200);
    expect(summaryRes1.body.holdings).toHaveLength(1);
    expect(summaryRes1.body.holdings[0].tickerSymbol).toBe('AAPL');
    expect(summaryRes1.body.holdings[0].totalShares).toBe(10);
    // Current price is 200, cost is 185.50, so unrealized P/L should be positive
    expect(summaryRes1.body.totalValueUSD).toBe(2000); // 10 * 200
    expect(summaryRes1.body.unrealizedPLUSD).toBeCloseTo(145, 0); // (200 - 185.5) * 10

    // Step 3: Update the transaction (add more shares)
    const updateRes = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('x-user-id', TEST_USER_ID)
      .send({
        shares: 20,
        totalAmount: 3710.00,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.shares).toBe(20);

    // Step 4: Get portfolio summary — should reflect updated holding
    const summaryRes2 = await request(app)
      .get('/api/portfolio/summary')
      .set('x-user-id', TEST_USER_ID);

    expect(summaryRes2.status).toBe(200);
    expect(summaryRes2.body.holdings[0].totalShares).toBe(20);
    expect(summaryRes2.body.totalValueUSD).toBe(4000); // 20 * 200

    // Step 5: Delete the transaction
    const deleteRes = await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('x-user-id', TEST_USER_ID);

    expect(deleteRes.status).toBe(204);

    // Step 6: Get portfolio summary — should be empty
    const summaryRes3 = await request(app)
      .get('/api/portfolio/summary')
      .set('x-user-id', TEST_USER_ID);

    expect(summaryRes3.status).toBe(200);
    expect(summaryRes3.body.holdings).toHaveLength(0);
    expect(summaryRes3.body.totalValueUSD).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// Flow 3: Dime Import → Duplicate Detection → Selective Save
// ────────────────────────────────────────────────────────────

describe('Integration Flow 3: Dime Import → Duplicate Detection → Selective Save', () => {
  let app: express.Express;
  let transactionRepo: InMemoryTransactionRepository;

  beforeEach(() => {
    transactionRepo = new InMemoryTransactionRepository();
    const importService = new DimeImportService(transactionRepo, TEST_USER_ID);

    app = express();
    app.use(express.json());
    app.use('/api/import', createImportRouter(importService));
  });

  it('should parse Dime CSV, detect duplicates on re-import, and allow selective save', async () => {
    const csvContent = [
      'ticker,date,price,shares,total',
      'AAPL,2024-01-15,185.50,10,1855.00',
      'VOO,2024-02-01,420.00,5,2100.00',
    ].join('\n');

    // Step 1: First import — parse the file
    const parseRes1 = await request(app)
      .post('/api/import/dime')
      .attach('file', Buffer.from(csvContent), { filename: 'dime_export.csv', contentType: 'text/csv' });

    expect(parseRes1.status).toBe(200);
    expect(parseRes1.body.transactions).toHaveLength(2);
    expect(parseRes1.body.successfulRows).toBe(2);
    expect(parseRes1.body.transactions[0].ticker).toBe('AAPL');
    expect(parseRes1.body.transactions[1].ticker).toBe('VOO');

    // Step 2: Confirm import (save the transactions)
    const confirmRes = await request(app)
      .post('/api/import/dime/confirm')
      .send({
        transactions: parseRes1.body.transactions,
        overwriteDuplicates: false,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.imported).toBe(2);
    expect(confirmRes.body.skipped).toBe(0);

    // Step 3: Re-import same data — should detect duplicates
    const parseRes2 = await request(app)
      .post('/api/import/dime')
      .attach('file', Buffer.from(csvContent), { filename: 'dime_export.csv', contentType: 'text/csv' });

    expect(parseRes2.status).toBe(200);
    expect(parseRes2.body.transactions).toHaveLength(2);

    // Step 4: Confirm re-import without overwrite — should skip duplicates
    const confirmRes2 = await request(app)
      .post('/api/import/dime/confirm')
      .send({
        transactions: parseRes2.body.transactions,
        overwriteDuplicates: false,
      });

    expect(confirmRes2.status).toBe(200);
    expect(confirmRes2.body.imported).toBe(0);
    expect(confirmRes2.body.skipped).toBe(2);

    // Step 5: Confirm re-import WITH overwrite — should overwrite duplicates
    const confirmRes3 = await request(app)
      .post('/api/import/dime/confirm')
      .send({
        transactions: parseRes2.body.transactions,
        overwriteDuplicates: true,
      });

    expect(confirmRes3.status).toBe(200);
    expect(confirmRes3.body.overwritten).toBe(2);
    expect(confirmRes3.body.imported).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// Flow 4: Export CSV → Import CSV Round-trip
// ────────────────────────────────────────────────────────────

describe('Integration Flow 4: Export CSV → Import CSV Round-trip', () => {
  let app: express.Express;
  let transactionRepo: InMemoryTransactionRepository;

  beforeEach(() => {
    transactionRepo = new InMemoryTransactionRepository();
    const txnService = new TransactionService(transactionRepo);
    const exportProvider = new RepositoryTransactionProvider(transactionRepo);
    const exportService = new ExportService(exportProvider);
    const cache = new InMemoryCache();

    app = express();
    app.use(express.json());
    app.use('/api/transactions', createTransactionsRouter({ service: txnService, cache }));
    app.use('/api/export', createExportRouter(exportService));
  });

  it('should create transactions, export to CSV, and verify CSV contains the data', async () => {
    // Step 1: Create some transactions
    const txns = [
      { tickerSymbol: 'AAPL', transactionDate: '2024-01-15', pricePerShare: 185.50, shares: 10, totalAmount: 1855.00 },
      { tickerSymbol: 'VOO', transactionDate: '2024-02-01', pricePerShare: 420.00, shares: 5, totalAmount: 2100.00 },
      { tickerSymbol: 'MSFT', transactionDate: '2024-03-10', pricePerShare: 410.25, shares: 3, totalAmount: 1230.75 },
    ];

    for (const txn of txns) {
      const res = await request(app)
        .post('/api/transactions')
        .set('x-user-id', TEST_USER_ID)
        .send(txn);
      expect(res.status).toBe(201);
    }

    // Step 2: Export to CSV
    const exportRes = await request(app)
      .get('/api/export/transactions?format=csv');

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');

    // Step 3: Parse the CSV
    const csvContent = exportRes.text;
    const lines = csvContent.split('\n');

    // Header line
    expect(lines[0]).toBe('ticker,date,price_per_share,shares,total_amount');

    // Data lines (should have 3 transaction rows)
    const dataLines = lines.slice(1).filter((l: string) => l.trim().length > 0);
    expect(dataLines).toHaveLength(3);

    // Verify each transaction is in the CSV
    const csvData = dataLines.map((line: string) => {
      const [ticker, date, price, shares, total] = line.split(',');
      return { ticker, date, price: parseFloat(price), shares: parseFloat(shares), total: parseFloat(total) };
    });

    expect(csvData.find((d: { ticker: string }) => d.ticker === 'AAPL')).toMatchObject({
      ticker: 'AAPL',
      date: '2024-01-15',
      price: 185.5,
      shares: 10,
      total: 1855,
    });

    expect(csvData.find((d: { ticker: string }) => d.ticker === 'VOO')).toMatchObject({
      ticker: 'VOO',
      date: '2024-02-01',
      price: 420,
      shares: 5,
      total: 2100,
    });

    expect(csvData.find((d: { ticker: string }) => d.ticker === 'MSFT')).toMatchObject({
      ticker: 'MSFT',
      date: '2024-03-10',
      price: 410.25,
      shares: 3,
      total: 1230.75,
    });
  });

  it('should export and then import back, preserving data integrity', async () => {
    // Step 1: Create transactions
    await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({ tickerSymbol: 'AAPL', transactionDate: '2024-05-10', pricePerShare: 190.00, shares: 8, totalAmount: 1520.00 });

    await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({ tickerSymbol: 'VOO', transactionDate: '2024-06-20', pricePerShare: 440.00, shares: 3, totalAmount: 1320.00 });

    // Step 2: Export CSV
    const exportRes = await request(app).get('/api/export/transactions?format=csv');
    expect(exportRes.status).toBe(200);

    // Step 3: Import the CSV back via the ExportService.importFromCSV method
    const exportService = new ExportService(new RepositoryTransactionProvider(transactionRepo));
    const imported = exportService.importFromCSV(Buffer.from(exportRes.text, 'utf-8'));

    expect(imported).toHaveLength(2);
    expect(imported.find((t) => t.ticker === 'AAPL')).toMatchObject({
      ticker: 'AAPL',
      date: '2024-05-10',
      price_per_share: 190,
      shares: 8,
      total_amount: 1520,
    });
    expect(imported.find((t) => t.ticker === 'VOO')).toMatchObject({
      ticker: 'VOO',
      date: '2024-06-20',
      price_per_share: 440,
      shares: 3,
      total_amount: 1320,
    });
  });
});

// ────────────────────────────────────────────────────────────
// Flow 5: Dividend CRUD → Total Return Recalculation
// ────────────────────────────────────────────────────────────

describe('Integration Flow 5: Dividend CRUD → Total Return Recalculation', () => {
  let app: express.Express;
  let transactionRepo: InMemoryTransactionRepository;
  let dividendRepo: InMemoryDividendRepository;

  beforeEach(() => {
    transactionRepo = new InMemoryTransactionRepository();
    dividendRepo = new InMemoryDividendRepository();
    const txnService = new TransactionService(transactionRepo);
    const dividendService = new DividendService(dividendRepo, transactionRepo);
    const cache = new InMemoryCache();

    app = express();
    app.use(express.json());
    app.use('/api/transactions', createTransactionsRouter({ service: txnService, cache }));
    app.use('/api/dividends', createDividendsRouter({ service: dividendService, cache }));
  });

  it('should create a holding, add dividends, verify summary, then delete and verify update', async () => {
    // Step 1: Create a transaction (establish holding)
    const txnRes = await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-10',
        pricePerShare: 185.00,
        shares: 20,
        totalAmount: 3700.00,
      });

    expect(txnRes.status).toBe(201);

    // Step 2: Create a dividend for the held ticker
    const divRes1 = await request(app)
      .post('/api/dividends')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.96,
        totalAmount: 19.20,
        sharesHeld: 20,
      });

    expect(divRes1.status).toBe(201);
    expect(divRes1.body.tickerSymbol).toBe('AAPL');
    expect(divRes1.body.totalAmount).toBe(19.2);
    const divId1 = divRes1.body.id;

    // Step 3: Create a second dividend
    const divRes2 = await request(app)
      .post('/api/dividends')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'AAPL',
        dividendDate: '2024-06-15',
        amountPerShare: 1.00,
        totalAmount: 20.00,
        sharesHeld: 20,
      });

    expect(divRes2.status).toBe(201);
    const divId2 = divRes2.body.id;

    // Step 4: Get dividends list — should have 2
    const listRes = await request(app)
      .get('/api/dividends')
      .set('x-user-id', TEST_USER_ID);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);

    // Step 5: Get dividend summary — cumulative total should be 39.20
    const summaryRes1 = await request(app)
      .get('/api/dividends/summary?range=ALL')
      .set('x-user-id', TEST_USER_ID);

    expect(summaryRes1.status).toBe(200);
    expect(summaryRes1.body.totalAmount).toBeCloseTo(39.20, 2);
    expect(summaryRes1.body.count).toBe(2);

    // Step 6: Delete one dividend
    const deleteRes = await request(app)
      .delete(`/api/dividends/${divId1}`)
      .set('x-user-id', TEST_USER_ID);

    expect(deleteRes.status).toBe(204);

    // Step 7: Get updated summary — should reflect only remaining dividend
    const summaryRes2 = await request(app)
      .get('/api/dividends/summary?range=ALL')
      .set('x-user-id', TEST_USER_ID);

    expect(summaryRes2.status).toBe(200);
    expect(summaryRes2.body.totalAmount).toBeCloseTo(20.00, 2);
    expect(summaryRes2.body.count).toBe(1);
  });

  it('should reject dividend for a ticker not held by the user', async () => {
    const divRes = await request(app)
      .post('/api/dividends')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.96,
        totalAmount: 19.20,
        sharesHeld: 20,
      });

    expect(divRes.status).toBe(400);
    expect(divRes.body.code).toBe('TICKER_NOT_HELD');
  });

  it('should reject dividend for a date before the user bought the ticker', async () => {
    // Create a transaction in March
    await request(app)
      .post('/api/transactions')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'VOO',
        transactionDate: '2024-03-01',
        pricePerShare: 420.00,
        shares: 5,
        totalAmount: 2100.00,
      });

    // Try to record a dividend for January (before the buy)
    const divRes = await request(app)
      .post('/api/dividends')
      .set('x-user-id', TEST_USER_ID)
      .send({
        tickerSymbol: 'VOO',
        dividendDate: '2024-01-15',
        amountPerShare: 1.50,
        totalAmount: 7.50,
        sharesHeld: 5,
      });

    expect(divRes.status).toBe(400);
    expect(divRes.body.code).toBe('TICKER_NOT_HELD');
  });
});
