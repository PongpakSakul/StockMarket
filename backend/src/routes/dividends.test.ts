import request from 'supertest';
import express from 'express';
import { createDividendsRouter } from './dividends';
import { DividendService } from '../services/dividend-service';
import { InMemoryDividendRepository } from '../repositories/dividend-repository';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';
import { TransactionService } from '../services/transaction-service';

// ────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────

function createTestApp() {
  const dividendRepository = new InMemoryDividendRepository();
  const transactionRepository = new InMemoryTransactionRepository();
  const dividendService = new DividendService(dividendRepository, transactionRepository);
  const transactionService = new TransactionService(transactionRepository);
  const router = createDividendsRouter(dividendService);

  const app = express();
  app.use(express.json());
  app.use('/api/dividends', router);

  return { app, dividendRepository, transactionRepository, dividendService, transactionService };
}

/**
 * Helper: seed a transaction so the user "holds" a ticker on a given date.
 */
async function seedTransaction(
  transactionService: TransactionService,
  userId: string,
  tickerSymbol: string,
  transactionDate: string,
) {
  return transactionService.createTransaction({
    userId,
    tickerSymbol,
    transactionDate,
    pricePerShare: 100,
    shares: 10,
    totalAmount: 1000,
  });
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Dividend API Endpoints', () => {
  describe('POST /api/dividends', () => {
    it('should create a dividend with valid data', async () => {
      const { app, transactionService } = createTestApp();

      // User must hold the ticker before recording a dividend
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'AAPL',
          dividendDate: '2024-03-15',
          amountPerShare: 0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
        userId: 'user-1',
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('should reject invalid ticker symbol', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'INVALID_TICKER_XYZ',
          dividendDate: '2024-03-15',
          amountPerShare: 0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TICKER');
    });

    it('should reject future date', async () => {
      const { app, transactionService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'AAPL',
          dividendDate: futureDateStr,
          amountPerShare: 0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE');
    });

    it('should reject negative amount per share', async () => {
      const { app, transactionService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'AAPL',
          dividendDate: '2024-03-15',
          amountPerShare: -0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should reject missing required fields', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'AAPL',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should reject dividend for ticker not held by user', async () => {
      const { app } = createTestApp();

      // User does NOT hold AAPL
      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-1')
        .send({
          tickerSymbol: 'AAPL',
          dividendDate: '2024-03-15',
          amountPerShare: 0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TICKER_NOT_HELD');
    });

    it('should use x-user-id header for userId', async () => {
      const { app, transactionService } = createTestApp();
      await seedTransaction(transactionService, 'user-42', 'VOO', '2024-01-01');

      const res = await request(app)
        .post('/api/dividends')
        .set('x-user-id', 'user-42')
        .send({
          tickerSymbol: 'VOO',
          dividendDate: '2024-03-15',
          amountPerShare: 1.50,
          totalAmount: 15.00,
          sharesHeld: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe('user-42');
    });
  });

  describe('GET /api/dividends', () => {
    it('should return paginated dividends for the user', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');
      await seedTransaction(transactionService, 'user-1', 'VOO', '2024-01-01');

      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });
      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        dividendDate: '2024-06-15',
        amountPerShare: 1.50,
        totalAmount: 15.00,
        sharesHeld: 10,
      });

      const res = await request(app)
        .get('/api/dividends')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
    });

    it('should filter by ticker', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');
      await seedTransaction(transactionService, 'user-1', 'VOO', '2024-01-01');

      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });
      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        dividendDate: '2024-06-15',
        amountPerShare: 1.50,
        totalAmount: 15.00,
        sharesHeld: 10,
      });

      const res = await request(app)
        .get('/api/dividends?ticker=AAPL')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tickerSymbol).toBe('AAPL');
    });

    it('should filter by date range', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });
      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-09-15',
        amountPerShare: 0.25,
        totalAmount: 2.50,
        sharesHeld: 10,
      });

      const res = await request(app)
        .get('/api/dividends?from=2024-05-01&to=2024-12-31')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].dividendDate).toBe('2024-09-15');
    });

    it('should paginate results', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      for (let i = 1; i <= 3; i++) {
        await dividendService.createDividend({
          userId: 'user-1',
          tickerSymbol: 'AAPL',
          dividendDate: `2024-0${i}-15`,
          amountPerShare: 0.24,
          totalAmount: 2.40,
          sharesHeld: 10,
        });
      }

      const res = await request(app)
        .get('/api/dividends?page=1&pageSize=2')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(3);
      expect(res.body.totalPages).toBe(2);
    });
  });

  describe('PUT /api/dividends/:id', () => {
    it('should update an existing dividend', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const created = await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });

      const res = await request(app)
        .put(`/api/dividends/${created.id}`)
        .set('x-user-id', 'user-1')
        .send({
          amountPerShare: 0.30,
          totalAmount: 3.00,
        });

      expect(res.status).toBe(200);
      expect(res.body.amountPerShare).toBe(0.30);
      expect(res.body.totalAmount).toBe(3.00);
      expect(res.body.tickerSymbol).toBe('AAPL');
    });

    it('should return 404 for non-existent dividend', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .put('/api/dividends/non-existent-id')
        .set('x-user-id', 'user-1')
        .send({
          amountPerShare: 0.30,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should validate updated fields', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const created = await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });

      const res = await request(app)
        .put(`/api/dividends/${created.id}`)
        .set('x-user-id', 'user-1')
        .send({
          amountPerShare: -1,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_AMOUNT');
    });

    it('should not allow updating another user\'s dividend', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const created = await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });

      const res = await request(app)
        .put(`/api/dividends/${created.id}`)
        .set('x-user-id', 'user-2')
        .send({
          amountPerShare: 0.50,
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/dividends/:id', () => {
    it('should delete an existing dividend', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const created = await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });

      const res = await request(app)
        .delete(`/api/dividends/${created.id}`)
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent dividend', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .delete('/api/dividends/non-existent-id')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should not allow deleting another user\'s dividend', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      const created = await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });

      const res = await request(app)
        .delete(`/api/dividends/${created.id}`)
        .set('x-user-id', 'user-2');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/dividends/summary', () => {
    it('should return dividend summary for a time range', async () => {
      const { app, transactionService, dividendService } = createTestApp();
      await seedTransaction(transactionService, 'user-1', 'AAPL', '2024-01-01');

      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-03-15',
        amountPerShare: 0.24,
        totalAmount: 2.40,
        sharesHeld: 10,
      });
      await dividendService.createDividend({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        dividendDate: '2024-06-15',
        amountPerShare: 0.25,
        totalAmount: 2.50,
        sharesHeld: 10,
      });

      const res = await request(app)
        .get('/api/dividends/summary?range=ALL')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.totalAmount).toBeCloseTo(4.90);
      expect(res.body.count).toBe(2);
      expect(res.body.fromDate).toBeDefined();
      expect(res.body.toDate).toBeDefined();
    });

    it('should return empty summary when no dividends in range', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/dividends/summary?range=1W')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.totalAmount).toBe(0);
      expect(res.body.count).toBe(0);
    });

    it('should reject invalid time range', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/dividends/summary?range=INVALID')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_RANGE');
    });

    it('should default to 1Y range when not specified', async () => {
      const { app } = createTestApp();

      const res = await request(app)
        .get('/api/dividends/summary')
        .set('x-user-id', 'user-1');

      expect(res.status).toBe(200);
      expect(res.body.fromDate).toBeDefined();
      expect(res.body.toDate).toBeDefined();
    });
  });
});
