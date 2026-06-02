import { ExportFilters, StructuredTransaction, Transaction } from '../types';
import { ITransactionRepository } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// CSV Constants
// ────────────────────────────────────────────────────────────

const CSV_HEADERS = ['ticker', 'date', 'price_per_share', 'shares', 'total_amount'];
const CSV_HEADER_LINE = CSV_HEADERS.join(',');

// ────────────────────────────────────────────────────────────
// Transaction Provider Interface
// ────────────────────────────────────────────────────────────

export interface ITransactionProvider {
  getFilteredTransactions(filters: ExportFilters): Promise<Transaction[]>;
}

// ────────────────────────────────────────────────────────────
// Default provider using ITransactionRepository
// ────────────────────────────────────────────────────────────

export class RepositoryTransactionProvider implements ITransactionProvider {
  constructor(private readonly repository: ITransactionRepository) {}

  async getFilteredTransactions(filters: ExportFilters): Promise<Transaction[]> {
    const result = await this.repository.findAll({
      tickerSymbol: filters.tickerSymbol,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      page: 1,
      pageSize: 100_000, // effectively no limit
      sortBy: 'date',
      sortOrder: 'asc',
    });
    return result.data;
  }
}

// ────────────────────────────────────────────────────────────
// Export Service
// ────────────────────────────────────────────────────────────

export class ExportService {
  constructor(private readonly transactionProvider: ITransactionProvider) {}

  /**
   * Export transactions to CSV format.
   * Columns: ticker, date, price_per_share, shares, total_amount
   * Returns a Buffer containing the CSV content.
   * Empty results return headers only.
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   */
  async exportToCSV(filters: ExportFilters): Promise<Buffer> {
    const transactions = await this.transactionProvider.getFilteredTransactions(filters);
    const lines: string[] = [CSV_HEADER_LINE];

    for (const txn of transactions) {
      const row = [
        escapeCsvField(txn.tickerSymbol),
        escapeCsvField(txn.transactionDate),
        txn.pricePerShare.toString(),
        txn.shares.toString(),
        txn.totalAmount.toString(),
      ].join(',');
      lines.push(row);
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  /**
   * Export transactions to Excel (.xlsx) format.
   * Uses a simple XML-based spreadsheet format (SpreadsheetML)
   * to avoid external dependencies.
   *
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async exportToExcel(filters: ExportFilters): Promise<Buffer> {
    const transactions = await this.transactionProvider.getFilteredTransactions(filters);

    const xml = buildSpreadsheetML(transactions);
    return Buffer.from(xml, 'utf-8');
  }

  /**
   * Import transactions from a CSV buffer.
   * Parses the CSV and returns an array of StructuredTransaction objects.
   * Expects the CSV to have headers: ticker, date, price_per_share, shares, total_amount
   *
   * Requirements: 8.6
   */
  importFromCSV(csvBuffer: Buffer): StructuredTransaction[] {
    const content = csvBuffer.toString('utf-8').trim();
    if (!content) {
      return [];
    }

    const lines = content.split(/\r?\n/);
    if (lines.length <= 1) {
      // Only headers or empty
      return [];
    }

    // Skip header line
    const dataLines = lines.slice(1);
    const transactions: StructuredTransaction[] = [];

    for (const line of dataLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const fields = parseCsvLine(trimmed);
      if (fields.length < 5) continue;

      const [ticker, date, priceStr, sharesStr, totalStr] = fields;

      const price_per_share = parseFloat(priceStr);
      const shares = parseFloat(sharesStr);
      const total_amount = parseFloat(totalStr);

      if (isNaN(price_per_share) || isNaN(shares) || isNaN(total_amount)) {
        continue;
      }

      transactions.push({
        ticker: ticker.trim(),
        date: date.trim(),
        price_per_share,
        shares,
        total_amount,
      });
    }

    return transactions;
  }
}

// ────────────────────────────────────────────────────────────
// CSV Helpers
// ────────────────────────────────────────────────────────────

/**
 * Escape a CSV field value. If it contains commas, quotes, or newlines,
 * wrap in double quotes and escape internal quotes.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

// ────────────────────────────────────────────────────────────
// SpreadsheetML (Simple Excel XML format)
// ────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSpreadsheetML(transactions: Transaction[]): string {
  const rows: string[] = [];

  // Header row
  const headerCells = CSV_HEADERS.map(
    (h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`,
  ).join('');
  rows.push(`<Row>${headerCells}</Row>`);

  // Data rows
  for (const txn of transactions) {
    const cells = [
      `<Cell><Data ss:Type="String">${escapeXml(txn.tickerSymbol)}</Data></Cell>`,
      `<Cell><Data ss:Type="String">${escapeXml(txn.transactionDate)}</Data></Cell>`,
      `<Cell><Data ss:Type="Number">${txn.pricePerShare}</Data></Cell>`,
      `<Cell><Data ss:Type="Number">${txn.shares}</Data></Cell>`,
      `<Cell><Data ss:Type="Number">${txn.totalAmount}</Data></Cell>`,
    ].join('');
    rows.push(`<Row>${cells}</Row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Transactions">
    <Table>
      ${rows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;
}
