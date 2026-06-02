import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DimeImportService } from './dime-import.service';
import { InMemoryTransactionRepository } from '../transaction/transaction.repository';
import { APIError, StructuredTransaction } from '../../types';

// ────────────────────────────────────────────────────────────
// Multer configuration for file uploads
// ────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ────────────────────────────────────────────────────────────
// Default repository & service (can be overridden via factory)
// ────────────────────────────────────────────────────────────

const defaultRepository = new InMemoryTransactionRepository();
const defaultService = new DimeImportService(defaultRepository);

// ────────────────────────────────────────────────────────────
// Factory to create router with injected service (for testing)
// ────────────────────────────────────────────────────────────

export function createImportRouter(service?: DimeImportService): Router {
  const importService = service ?? defaultService;
  const router = Router();

  /**
   * POST /api/import/dime
   *
   * Multipart file upload for CSV or JSON from Dime app.
   * Detects format from file extension or content-type.
   * Returns ImportParseResult with parsed transactions.
   *
   * Requirements: 13.1, 13.2, 13.5
   */
  router.post('/dime', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        const apiError: APIError = {
          code: 'INVALID_AMOUNT',
          message: 'No file uploaded. Please provide a CSV or JSON file.',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const format = detectFormat(req.file);

      if (!format) {
        const apiError: APIError = {
          code: 'UNSUPPORTED_FORMAT',
          message: 'Unsupported file format. Please upload a CSV or JSON file.',
          retryable: false,
        };
        res.status(415).json(apiError);
        return;
      }

      const result = importService.parseFile(req.file.buffer, format);
      res.status(200).json(result);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while importing the file',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  /**
   * POST /api/import/dime/confirm
   *
   * Confirm import of parsed transactions with duplicate handling.
   * Body: { transactions: StructuredTransaction[], overwriteDuplicates: boolean }
   *
   * Requirements: 13.4, 13.6
   */
  router.post('/dime/confirm', async (req: Request, res: Response) => {
    try {
      const { transactions, overwriteDuplicates } = req.body;

      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        const apiError: APIError = {
          code: 'INVALID_AMOUNT',
          message: 'No transactions provided for import confirmation.',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const result = await importService.importTransactions(
        transactions as StructuredTransaction[],
        overwriteDuplicates ?? false,
      );

      res.status(200).json(result);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while confirming the import',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  return router;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * Detect file format from extension or MIME type.
 */
function detectFormat(file: Express.Multer.File): 'csv' | 'json' | null {
  const originalName = file.originalname.toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (originalName.endsWith('.csv') || mimeType === 'text/csv') {
    return 'csv';
  }

  if (
    originalName.endsWith('.json') ||
    mimeType === 'application/json'
  ) {
    return 'json';
  }

  return null;
}

// Default export for convenience
export default createImportRouter();
