import request from 'supertest';
import express from 'express';
import { createExportRouter } from './export';
import { ExportService, RepositoryTransactionProvider } from '../services/export-service';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────

function createTestApp() {
  const repository = new InMemoryTransactionRepository();
  const provider = new RepositoryTransactionProvider(repository);
  const exportService = new ExportService(provider);
  const router = createExportRouter(exportService);

  const app = express();
  app.use(express.json());
  app.use('/api/export', router);

  return { app, repository };
}

async function seedTransactions(repository: InMemoryTransactionRepository) {
  await repository.create({
    userId: 'user-1',
    tickerSymbol: 'AAPL',
    transactionDate: '2024-01-15',
    pricePerShare: 185.50,
    shares: 10,
    totalAmount: 1855.00,
    source: 'manual',
  });
  await repository.create({
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-02-20',
    pricePerShare: 420.75,
    shares: 5,
    totalAmount: 2103.75,
    source: 'manual',
  });
  await repository.create({
    userId: 'user-1',
    tickerSymbol: 'AAPL',
    transactionDate: '2024-03-10',
    pricePerShare: 172.00,
    shares: 8,
    totalAmount: 1376.00,
    source: 'dime_import',
  });
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Export API Endpoints', () => {
  describe('GET /api/export/transactions', () => {
    it('should export transactions as CSV', async () => {
      const { app, repository } = createTestApp();
      await seedTransactions(repository);

      const res = await request(app)
        .get('/api/export/transactions?format=csv');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('transactions_export.csv');

      const csvContent = res.text;
      const lines = csvContent.split('\n');
      // Header + 3 data rows
      expect(lines.length).toBe(4);
      expect(lines[0]).toBe('ticker,date,price_per_share,shares,total_amount');
      expect(lines[1]).toContain('AAPL');
      expect(lines[1]).toContain('2024-01-15');
    });

    it('should export transactions as Excel (xlsx)', async () => {
      const { app, repository } = createTestApp();
      await seedTransactions(repository);

      const res = await request(app)
        .get('/api/export/transactions?format=xlsx');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.ms-excel');
      expect(res.headers['content-disposition']).toContain('transactions_export.xlsx');

      // The body should contain XML spreadsheet content
      const content = res.text;
      expect(content).toContain('<?xml');
      expect(content).toContain('Workbook');
      expect(content).toContain('AAPL');
    });

    it('should filter by ticker symbol', async () => {
      const { app, repository } = createTestApp();
      await seedTransactions(repository);

      const res = await request(app)
        .get('/api/export/transactions?format=csv&ticker=AAPL');

      expect(res.status).toBe(200);
      const csvContent = res.text;
      const lines = csvContent.split('\n').filter((l) => l.trim());
      // Header + 2 AAPL rows
      expect(lines.length).toBe(3);
      expect(csvContent).not.toContain('VOO');
    });

    it('should filter by date range', async () => {
      const { app, repository } = createTestApp();
      await seedTransactions(repository);

      const res = await request(app)
        .get('/api/export/transactions?format=csv&from=2024-02-01&to=2024-02-28');

      expect(res.status).toBe(200);
      const csvContent = res.text;
      const lines = csvContent.split('\n').filter((l) => l.trim());
      // Header + 1 VOO row in Feb
      expect(lines.length).toBe(2);
      expect(csvContent).toContain('VOO');
      expect(csvContent).not.toContain('AAPL');
    });

    it('should return 400 for invalid format', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/export/transactions?format=pdf');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should return 400 when format is missing', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/export/transactions');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should return CSV with only headers when no transactions match', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/export/transactions?format=csv&ticker=NONEXIST');

      expect(res.status).toBe(200);
      const csvContent = res.text;
      const lines = csvContent.split('\n').filter((l) => l.trim());
      // Only header row
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('ticker,date,price_per_share,shares,total_amount');
    });
  });
});
