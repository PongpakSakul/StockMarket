import request from 'supertest';
import app from '../app';
import * as ocrService from '../services/ocr-service';
import { OCRResult } from '../types';

// Mock the OCR service — the slip parser is pure logic so we let it run for real
jest.mock('../services/ocr-service');

const mockExtractText = ocrService.extractText as jest.MockedFunction<
  typeof ocrService.extractText
>;

/**
 * Helper: create a tiny valid PNG buffer (1×1 pixel).
 * This is the smallest valid PNG file possible.
 */
function makePngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
}

/**
 * Helper: create a tiny valid JPEG buffer.
 */
function makeJpegBuffer(): Buffer {
  // Minimal JPEG: SOI + APP0 + minimal content + EOI
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
}

/** OCR text that the slip parser can extract all fields from */
const FULL_OCR_TEXT =
  'Buy VOO\nDate: 2024-03-15\nPrice per share: $450.25\nShares: 1.123456\nTotal: $505.59';

/** OCR result for a successful full extraction */
const successfulOcrResult: OCRResult = {
  text: FULL_OCR_TEXT,
  confidence: 0.95,
  success: true,
};

/** OCR result for a partial extraction (missing ticker) */
const partialOcrResult: OCRResult = {
  text: 'Date: 2024-03-15\nPrice per share: $450.25\nShares: 1.123456\nTotal: $505.59',
  confidence: 0.85,
  success: true,
};

/** OCR result for a failure */
const failedOcrResult: OCRResult = {
  text: '',
  confidence: 0,
  success: false,
  error: 'No text detected in the image',
};

describe('Slip Upload Routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ──────────────────────────────────────────────────────
  // POST /api/slips/upload — single slip
  // ──────────────────────────────────────────────────────

  describe('POST /api/slips/upload', () => {
    it('should process a valid PNG slip and return structured transaction', async () => {
      mockExtractText.mockResolvedValue(successfulOcrResult);

      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', makePngBuffer(), { filename: 'slip.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.filename).toBe('slip.png');
      expect(res.body.transaction).toBeDefined();
      expect(res.body.transaction.ticker).toBe('VOO');
      expect(res.body.transaction.date).toBe('2024-03-15');
      expect(res.body.parseResult).toBeDefined();
      expect(res.body.parseResult.missingFields).toEqual([]);
    });

    it('should process a valid JPEG slip', async () => {
      mockExtractText.mockResolvedValue(successfulOcrResult);

      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', makeJpegBuffer(), { filename: 'slip.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return PARSE_INCOMPLETE when some fields are missing', async () => {
      mockExtractText.mockResolvedValue(partialOcrResult);

      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', makePngBuffer(), { filename: 'slip.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.errorCode).toBe('PARSE_INCOMPLETE');
      expect(res.body.parseResult.missingFields).toContain('ticker');
      // Transaction should still be returned with defaults
      expect(res.body.transaction).toBeDefined();
      expect(res.body.transaction.ticker).toBe('UNKNOWN');
    });

    it('should return 502 OCR_FAILED when OCR fails', async () => {
      mockExtractText.mockResolvedValue(failedOcrResult);

      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', makePngBuffer(), { filename: 'slip.png', contentType: 'image/png' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('OCR_FAILED');
      expect(res.body.retryable).toBe(true);
    });

    it('should return 415 UNSUPPORTED_FORMAT for non-image files', async () => {
      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', Buffer.from('not an image'), {
          filename: 'data.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
      expect(res.body.retryable).toBe(false);
    });

    it('should return 413 FILE_TOO_LARGE for oversized files', async () => {
      // Create a buffer just over 10MB
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 0);

      const res = await request(app)
        .post('/api/slips/upload')
        .attach('slip', largeBuffer, { filename: 'huge.png', contentType: 'image/png' });

      expect(res.status).toBe(413);
      expect(res.body.code).toBe('FILE_TOO_LARGE');
      expect(res.body.retryable).toBe(false);
    });

    it('should return 400 when no file is provided', async () => {
      const res = await request(app)
        .post('/api/slips/upload')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });
  });

  // ──────────────────────────────────────────────────────
  // POST /api/slips/upload-batch — multi-slip
  // ──────────────────────────────────────────────────────

  describe('POST /api/slips/upload-batch', () => {
    it('should process multiple slips in parallel', async () => {
      mockExtractText.mockResolvedValue(successfulOcrResult);

      const res = await request(app)
        .post('/api/slips/upload-batch')
        .attach('slips', makePngBuffer(), { filename: 'slip1.png', contentType: 'image/png' })
        .attach('slips', makePngBuffer(), { filename: 'slip2.png', contentType: 'image/png' })
        .attach('slips', makeJpegBuffer(), { filename: 'slip3.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.successful).toBe(3);
      expect(res.body.failed).toBe(0);
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0].transaction.ticker).toBe('VOO');
    });

    it('should handle partial failures — successful slips unaffected by failures', async () => {
      // First call succeeds, second fails, third succeeds
      mockExtractText
        .mockResolvedValueOnce(successfulOcrResult)
        .mockResolvedValueOnce(failedOcrResult)
        .mockResolvedValueOnce(successfulOcrResult);

      const res = await request(app)
        .post('/api/slips/upload-batch')
        .attach('slips', makePngBuffer(), { filename: 'good1.png', contentType: 'image/png' })
        .attach('slips', makePngBuffer(), { filename: 'bad.png', contentType: 'image/png' })
        .attach('slips', makePngBuffer(), { filename: 'good2.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.successful).toBe(2);
      expect(res.body.failed).toBe(1);

      // Verify the failed one
      const failedResult = res.body.results.find(
        (r: { filename: string }) => r.filename === 'bad.png',
      );
      expect(failedResult.success).toBe(false);
      expect(failedResult.errorCode).toBe('OCR_FAILED');

      // Verify successful ones are unaffected
      const goodResults = res.body.results.filter(
        (r: { success: boolean }) => r.success,
      );
      expect(goodResults).toHaveLength(2);
      goodResults.forEach((r: { transaction: { ticker: string } }) => {
        expect(r.transaction.ticker).toBe('VOO');
      });
    });

    it('should return 400 when no files are provided', async () => {
      const res = await request(app)
        .post('/api/slips/upload-batch')
        .send();

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should return 415 UNSUPPORTED_FORMAT when a non-image file is in the batch', async () => {
      const res = await request(app)
        .post('/api/slips/upload-batch')
        .attach('slips', Buffer.from('not an image'), {
          filename: 'data.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(415);
      expect(res.body.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should count successful + failed = total for batch results', async () => {
      mockExtractText
        .mockResolvedValueOnce(successfulOcrResult)
        .mockResolvedValueOnce(failedOcrResult);

      const res = await request(app)
        .post('/api/slips/upload-batch')
        .attach('slips', makePngBuffer(), { filename: 'a.png', contentType: 'image/png' })
        .attach('slips', makePngBuffer(), { filename: 'b.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.successful + res.body.failed).toBe(res.body.total);
    });
  });
});
