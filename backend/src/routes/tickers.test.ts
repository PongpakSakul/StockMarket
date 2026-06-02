import request from 'supertest';
import express from 'express';
import { createTickersRouter } from './tickers';

// ────────────────────────────────────────────────────────────
// Test setup
// ────────────────────────────────────────────────────────────

function createTestApp() {
  const router = createTickersRouter();
  const app = express();
  app.use(express.json());
  app.use('/api/tickers', router);
  return app;
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('Ticker Validation API Endpoints', () => {
  describe('GET /api/tickers/validate/:ticker', () => {
    it('should return valid: true for a known ticker', async () => {
      const app = createTestApp();

      const res = await request(app).get('/api/tickers/validate/AAPL');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ticker: 'AAPL',
        valid: true,
      });
    });

    it('should return valid: true for lowercase input (case-insensitive)', async () => {
      const app = createTestApp();

      const res = await request(app).get('/api/tickers/validate/voo');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ticker: 'VOO',
        valid: true,
      });
    });

    it('should return valid: false for an unknown ticker', async () => {
      const app = createTestApp();

      const res = await request(app).get('/api/tickers/validate/XYZZZ');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ticker: 'XYZZZ',
        valid: false,
      });
    });

    it('should validate ETF tickers', async () => {
      const app = createTestApp();

      const res = await request(app).get('/api/tickers/validate/QQQM');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        ticker: 'QQQM',
        valid: true,
      });
    });
  });
});
