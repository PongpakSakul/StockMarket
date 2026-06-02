import request from 'supertest';
import express from 'express';
import { createTransactionsRouter } from './transactions';
import { TransactionService } from '../services/transaction-service';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────

function createTestApp() {
  const repository = new InMemoryTransactionRepository();
  const service = new TransactionService(repository);
  const router = createTransactionsRouter(service);

  const app = express();
  app.use(express.json());
  app.use('/api/transactions', router);

  return { app, repository, service };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Transaction API Endpoints', () => {
  describe('POST /api/transactions', () => {
    it('should create a transaction with valid data', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'AAPL',
          transactionDate: '2024-01-15',
          pricePerShare: 185.50,
          shares: 10,
          totalAmount: 1855.00,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185.50,
        shares: 10,
        totalAmount: 1855.00,
        source: 'manual',
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('should reject invalid ticker symbol', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'INVALID_TICKER',
          transactionDate: '2024-01-15',
          pricePerShare: 100,
          shares: 5,
          totalAmount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    });

    it('should reject future date', async () => {
      const { app } = createTestApp();

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'AAPL',
          transactionDate: futureDateStr,
          pricePerShare: 100,
          shares: 5,
          totalAmount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE');
    });

    it('should reject negative price', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'AAPL',
          transactionDate: '2024-01-15',
          pricePerShare: -10,
          shares: 5,
          totalAmount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should reject zero shares', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'AAPL',
          transactionDate: '2024-01-15',
          pricePerShare: 100,
          shares: 0,
          totalAmount: 500,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should reject missing required fields', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .send({
          tickerSymbol: 'AAPL',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should use x-user-id header for userId', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/transactions')
        .set('x-user-id', 'user-123')
        .send({
          tickerSymbol: 'VOO',
          transactionDate: '2024-01-15',
          pricePerShare: 420.00,
          shares: 2,
          totalAmount: 840.00,
        });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe('user-123');
    });
  });

  describe('GET /api/transactions', () => {
    it('should return paginated transactions', async () => {
      const { app, service } = createTestApp();

      // Seed some transactions
      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });
      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-02-01',
        pricePerShare: 420,
        shares: 5,
        totalAmount: 2100,
      });

      const res = await request(app).get('/api/transactions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
    });

    it('should filter by ticker', async () => {
      const { app, service } = createTestApp();

      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });
      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-02-01',
        pricePerShare: 420,
        shares: 5,
        totalAmount: 2100,
      });

      const res = await request(app).get('/api/transactions?ticker=AAPL');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tickerSymbol).toBe('AAPL');
    });

    it('should filter by date range', async () => {
      const { app, service } = createTestApp();

      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });
      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-03-01',
        pricePerShare: 420,
        shares: 5,
        totalAmount: 2100,
      });

      const res = await request(app).get('/api/transactions?from=2024-02-01&to=2024-04-01');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tickerSymbol).toBe('VOO');
    });

    it('should sort by amount ascending', async () => {
      const { app, service } = createTestApp();

      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });
      await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-02-01',
        pricePerShare: 420,
        shares: 5,
        totalAmount: 2100,
      });

      const res = await request(app).get('/api/transactions?sort=amount&order=asc');

      expect(res.status).toBe(200);
      expect(res.body.data[0].totalAmount).toBe(1850);
      expect(res.body.data[1].totalAmount).toBe(2100);
    });

    it('should paginate results', async () => {
      const { app, service } = createTestApp();

      // Create 3 transactions
      for (let i = 0; i < 3; i++) {
        await service.createTransaction({
          userId: 'user-1',
          tickerSymbol: 'AAPL',
          transactionDate: `2024-01-${String(i + 10).padStart(2, '0')}`,
          pricePerShare: 185,
          shares: 10,
          totalAmount: 1850,
        });
      }

      const res = await request(app).get('/api/transactions?page=1&pageSize=2');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
    });
  });

  describe('PUT /api/transactions/:id', () => {
    it('should update an existing transaction', async () => {
      const { app, service } = createTestApp();

      const created = await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });

      const res = await request(app)
        .put(`/api/transactions/${created.id}`)
        .send({
          shares: 20,
          totalAmount: 3700,
        });

      expect(res.status).toBe(200);
      expect(res.body.shares).toBe(20);
      expect(res.body.totalAmount).toBe(3700);
      expect(res.body.tickerSymbol).toBe('AAPL');
    });

    it('should return 404 for non-existent transaction', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .put('/api/transactions/non-existent-id')
        .send({
          shares: 20,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should validate updated fields', async () => {
      const { app, service } = createTestApp();

      const created = await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });

      const res = await request(app)
        .put(`/api/transactions/${created.id}`)
        .send({
          tickerSymbol: 'INVALID_TICKER',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    it('should delete an existing transaction', async () => {
      const { app, service } = createTestApp();

      const created = await service.createTransaction({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 185,
        shares: 10,
        totalAmount: 1850,
      });

      const res = await request(app).delete(`/api/transactions/${created.id}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent transaction', async () => {
      const { app } = createTestApp();

      const res = await request(app).delete('/api/transactions/non-existent-id');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
