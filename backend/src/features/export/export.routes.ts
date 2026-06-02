import { Router, Request, Response } from 'express';
import { ExportService, RepositoryTransactionProvider } from './export.service';
import { InMemoryTransactionRepository } from '../transaction/transaction.repository';
import { ExportFilters, ExportFormat, APIError } from '../../types';

// ────────────────────────────────────────────────────────────
// Default repository & service (can be overridden via factory)
// ────────────────────────────────────────────────────────────

const defaultRepository = new InMemoryTransactionRepository();
const defaultProvider = new RepositoryTransactionProvider(defaultRepository);
const defaultService = new ExportService(defaultProvider);

// ────────────────────────────────────────────────────────────
// Factory to create router with injected service (for testing)
// ────────────────────────────────────────────────────────────

export function createExportRouter(service?: ExportService): Router {
  const exportService = service ?? defaultService;
  const router = Router();

  /**
   * GET /api/export/transactions
   *
   * Query params:
   *   - format: csv | xlsx (required)
   *   - ticker: filter by ticker symbol (optional)
   *   - from: filter by start date ISO 8601 (optional)
   *   - to: filter by end date ISO 8601 (optional)
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  router.get('/transactions', async (req: Request, res: Response) => {
    try {
      const format = String(req.query.format || '').toLowerCase();

      if (format !== 'csv' && format !== 'xlsx') {
        const apiError: APIError = {
          code: 'UNSUPPORTED_FORMAT',
          message: 'Format must be "csv" or "xlsx"',
          retryable: false,
        };
        res.status(400).json(apiError);
        return;
      }

      const filters: ExportFilters = {
        format: format as ExportFormat,
      };

      if (req.query.ticker) {
        filters.tickerSymbol = String(req.query.ticker).toUpperCase();
      }
      if (req.query.from) {
        filters.fromDate = String(req.query.from);
      }
      if (req.query.to) {
        filters.toDate = String(req.query.to);
      }

      let buffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      if (format === 'csv') {
        buffer = await exportService.exportToCSV(filters);
        contentType = 'text/csv; charset=utf-8';
        fileExtension = 'csv';
      } else {
        buffer = await exportService.exportToExcel(filters);
        contentType = 'application/vnd.ms-excel';
        fileExtension = 'xlsx';
      }

      const filename = `transactions_export.${fileExtension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(buffer);
    } catch {
      const apiError: APIError = {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while exporting transactions',
        retryable: true,
      };
      res.status(500).json(apiError);
    }
  });

  return router;
}

// Default export for convenience
export default createExportRouter();
