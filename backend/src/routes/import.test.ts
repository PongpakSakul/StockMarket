import request from 'supertest';
import express from 'express';
import { createImportRouter } from './import';
import { DimeImportService } from '../services/dime-import-service';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────

function createTestApp() {
  const repository = new InMemoryTransactionRepository();
  const importService = new DimeImportService(repository, 'user-1');
  const router = createImportRouter(importService);

  const app = express();
  app.use(express.json());
  app.use('/api/import', router);

  return { app, repository, importService };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Import API Endpoints', () => {
  describe('POST /api/import/dime', () => {
    it('should parse a valid CSV file', async () => {
      const { app } = createTestApp();

      const csvContent = 'ticker,date,price,shares,total\nAAPL,2024-01-15,185.50,10,1855.00\nVOO,2024-02-20,420.75,5,2103.75';

      const res = await request(app)
        .post('/api/import/dime')
        .attach('file', Buffer.from(csvContent), 'portfolio.csv');

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(2);
      expect(res.body.totalRows).toBe(2);
      expect(res.body.successfulRows).toBe(2);
      expect(res.body.errors).toHaveLength(0);
      expect(res.body.transactions[0]).toMatchObject({
        ticker: 'AAPL',
        date: '2024-01-15',
        price_per_share: 185.50,
        shares: 10,
        total_amount: 1855.00,
      });
    });

    it('should parse a valid JSON file', async () => {
      const { app } = createTestApp();

      const jsonContent = JSON.stringify([
        { ticker: 'AAPL', date: '2024-01-15', price: 185.50, shares: 10, total: 1855.00 },
        { ticker: 'VOO', date: '2024-02-20', price: 420.75, shares: 5, total: 2103.75 },
      ]);

      const res = await request(app)
        .post('/api/import/dime')
        .attach('file', Buffer.from(jsonContent), 'portfolio.json');

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(2);
      expect(res.body.totalRows).toBe(2);
      expect(res.body.successfulRows).toBe(2);
      expect(res.body.transactions[1]).toMatchObject({
        ticker: 'VOO',
        date: '2024-02-20',
        price_per_share: 420.75,
        shares: 5,
        total_amount: 2103.75,
      });
    });

    it('should return 415 for unsupported file format', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/import/dime')
        .attach('file', Buffer.from('some content'), 'portfolio.txt');

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should return 400 when no file is uploaded', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/import/dime');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No file uploaded');
    });

    it('should handle CSV with invalid rows gracefully', async () => {
      const { app } = createTestApp();

      const csvContent = 'ticker,date,price,shares,total\nAAPL,2024-01-15,185.50,10,1855.00\nINVALID,bad-date,abc,xyz,def';

      const res = await request(app)
        .post('/api/import/dime')
        .attach('file', Buffer.from(csvContent), 'portfolio.csv');

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(1);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.totalRows).toBe(2);
      expect(res.body.successfulRows).toBe(1);
    });

    it('should handle empty CSV file', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/import/dime')
        .attach('file', Buffer.from(''), 'portfolio.csv');

      expect(res.status).toBe(200);
      expect(res.body.transactions).toHaveLength(0);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toContain('empty');
    });
  });

  describe('POST /api/import/dime/confirm', () => {
    it('should import transactions successfully', async () => {
      const { app } = createTestApp();

      const transactions = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 185.50, shares: 10, total_amount: 1855.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.75, shares: 5, total_amount: 2103.75 },
      ];

      const res = await request(app)
        .post('/api/import/dime/confirm')
        .send({ transactions, overwriteDuplicates: false });

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(2);
      expect(res.body.skipped).toBe(0);
      expect(res.body.overwritten).toBe(0);
      expect(res.body.errors).toHaveLength(0);
    });

    it('should skip duplicates when overwriteDuplicates is false', async () => {
      const { app, repository } = createTestApp();

      // Seed an existing transaction
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185.50,
        shares: 10,
        totalAmount: 1855.00,
        source: 'manual',
      });

      const transactions = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 185.50, shares: 10, total_amount: 1855.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.75, shares: 5, total_amount: 2103.75 },
      ];

      const res = await request(app)
        .post('/api/import/dime/confirm')
        .send({ transactions, overwriteDuplicates: false });

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(1);
      expect(res.body.skipped).toBe(1);
      expect(res.body.overwritten).toBe(0);
    });

    it('should overwrite duplicates when overwriteDuplicates is true', async () => {
      const { app, repository } = createTestApp();

      // Seed an existing transaction
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185.50,
        shares: 10,
        totalAmount: 1855.00,
        source: 'manual',
      });

      const transactions = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 185.50, shares: 10, total_amount: 1855.00 },
      ];

      const res = await request(app)
        .post('/api/import/dime/confirm')
        .send({ transactions, overwriteDuplicates: true });

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(0);
      expect(res.body.skipped).toBe(0);
      expect(res.body.overwritten).toBe(1);
    });

    it('should return 400 when no transactions provided', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/import/dime/confirm')
        .send({ transactions: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No transactions provided');
    });

    it('should return 400 when transactions field is missing', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/import/dime/confirm')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
