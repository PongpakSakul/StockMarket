import { ExportService, ITransactionProvider, RepositoryTransactionProvider } from './export-service';
import { ExportFilters, Transaction, StructuredTransaction } from '../types';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';

// ────────────────────────────────────────────────────────────
// Test Helpers
// ────────────────────────────────────────────────────────────

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-06-15',
    pricePerShare: 450.25,
    shares: 2.5,
    totalAmount: 1125.63,
    source: 'manual',
    createdAt: '2024-06-15T10:00:00Z',
    updatedAt: '2024-06-15T10:00:00Z',
    ...overrides,
  };
}

class MockTransactionProvider implements ITransactionProvider {
  private transactions: Transaction[];

  constructor(transactions: Transaction[] = []) {
    this.transactions = transactions;
  }

  async getFilteredTransactions(filters: ExportFilters): Promise<Transaction[]> {
    let result = [...this.transactions];

    if (filters.tickerSymbol) {
      result = result.filter((t) => t.tickerSymbol === filters.tickerSymbol);
    }
    if (filters.fromDate) {
      result = result.filter((t) => t.transactionDate >= filters.fromDate!);
    }
    if (filters.toDate) {
      result = result.filter((t) => t.transactionDate <= filters.toDate!);
    }

    return result;
  }
}

// ────────────────────────────────────────────────────────────
// ExportService — exportToCSV
// ────────────────────────────────────────────────────────────

describe('ExportService', () => {
  describe('exportToCSV', () => {
    it('exports transactions with correct headers and data', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-01-10', pricePerShare: 400, shares: 1, totalAmount: 400 }),
        makeTransaction({ tickerSymbol: 'AAPL', transactionDate: '2024-02-15', pricePerShare: 180.5, shares: 3.5, totalAmount: 631.75 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToCSV({ format: 'csv' });
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      expect(lines[0]).toBe('ticker,date,price_per_share,shares,total_amount');
      expect(lines[1]).toBe('VOO,2024-01-10,400,1,400');
      expect(lines[2]).toBe('AAPL,2024-02-15,180.5,3.5,631.75');
    });

    it('returns headers only when no transactions match', async () => {
      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const buffer = await service.exportToCSV({ format: 'csv' });
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('ticker,date,price_per_share,shares,total_amount');
    });

    it('filters by ticker symbol', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-01-10', pricePerShare: 400, shares: 1, totalAmount: 400 }),
        makeTransaction({ tickerSymbol: 'AAPL', transactionDate: '2024-02-15', pricePerShare: 180, shares: 2, totalAmount: 360 }),
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-03-20', pricePerShare: 420, shares: 1.5, totalAmount: 630 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToCSV({ format: 'csv', tickerSymbol: 'VOO' });
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[1]).toContain('VOO');
      expect(lines[2]).toContain('VOO');
    });

    it('filters by date range', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-01-10' }),
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-02-15' }),
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-03-20' }),
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-04-25' }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToCSV({
        format: 'csv',
        fromDate: '2024-02-01',
        toDate: '2024-03-31',
      });
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      expect(lines).toHaveLength(3); // header + 2 data rows
      expect(lines[1]).toContain('2024-02-15');
      expect(lines[2]).toContain('2024-03-20');
    });

    it('handles decimal precision correctly', async () => {
      const transactions = [
        makeTransaction({ pricePerShare: 123.456789, shares: 0.123456, totalAmount: 15.24 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToCSV({ format: 'csv' });
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      expect(lines[1]).toContain('123.456789');
      expect(lines[1]).toContain('0.123456');
      expect(lines[1]).toContain('15.24');
    });
  });

  // ────────────────────────────────────────────────────────────
  // ExportService — exportToExcel
  // ────────────────────────────────────────────────────────────

  describe('exportToExcel', () => {
    it('generates valid SpreadsheetML XML', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-01-10', pricePerShare: 400, shares: 1, totalAmount: 400 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToExcel({ format: 'xlsx' });
      const content = buffer.toString('utf-8');

      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('Excel.Sheet');
      expect(content).toContain('<Worksheet ss:Name="Transactions">');
      expect(content).toContain('ticker');
      expect(content).toContain('date');
      expect(content).toContain('price_per_share');
      expect(content).toContain('shares');
      expect(content).toContain('total_amount');
    });

    it('includes transaction data in Excel output', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'AAPL', transactionDate: '2024-03-15', pricePerShare: 175.5, shares: 5, totalAmount: 877.5 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToExcel({ format: 'xlsx' });
      const content = buffer.toString('utf-8');

      expect(content).toContain('AAPL');
      expect(content).toContain('2024-03-15');
      expect(content).toContain('175.5');
      expect(content).toContain('5');
      expect(content).toContain('877.5');
    });

    it('handles empty results', async () => {
      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const buffer = await service.exportToExcel({ format: 'xlsx' });
      const content = buffer.toString('utf-8');

      // Should still have headers
      expect(content).toContain('ticker');
      expect(content).toContain('date');
    });

    it('filters by ticker symbol', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', pricePerShare: 400, shares: 1, totalAmount: 400 }),
        makeTransaction({ tickerSymbol: 'AAPL', pricePerShare: 180, shares: 2, totalAmount: 360 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToExcel({ format: 'xlsx', tickerSymbol: 'AAPL' });
      const content = buffer.toString('utf-8');

      expect(content).toContain('AAPL');
      expect(content).not.toContain('>VOO<');
    });

    it('escapes XML special characters', async () => {
      // This is a defensive test — ticker symbols shouldn't have special chars,
      // but the escaping should work regardless
      const transactions = [
        makeTransaction({ tickerSymbol: 'A&B', pricePerShare: 100, shares: 1, totalAmount: 100 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const buffer = await service.exportToExcel({ format: 'xlsx' });
      const content = buffer.toString('utf-8');

      expect(content).toContain('A&amp;B');
      expect(content).not.toContain('A&B');
    });
  });

  // ────────────────────────────────────────────────────────────
  // ExportService — importFromCSV
  // ────────────────────────────────────────────────────────────

  describe('importFromCSV', () => {
    it('parses valid CSV into StructuredTransaction array', () => {
      const csv = [
        'ticker,date,price_per_share,shares,total_amount',
        'VOO,2024-01-10,400,1,400',
        'AAPL,2024-02-15,180.5,3.5,631.75',
      ].join('\n');

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ticker: 'VOO',
        date: '2024-01-10',
        price_per_share: 400,
        shares: 1,
        total_amount: 400,
      });
      expect(result[1]).toEqual({
        ticker: 'AAPL',
        date: '2024-02-15',
        price_per_share: 180.5,
        shares: 3.5,
        total_amount: 631.75,
      });
    });

    it('returns empty array for empty buffer', () => {
      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from('', 'utf-8'));
      expect(result).toEqual([]);
    });

    it('returns empty array for headers-only CSV', () => {
      const csv = 'ticker,date,price_per_share,shares,total_amount';
      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));
      expect(result).toEqual([]);
    });

    it('skips rows with invalid numeric values', () => {
      const csv = [
        'ticker,date,price_per_share,shares,total_amount',
        'VOO,2024-01-10,400,1,400',
        'AAPL,2024-02-15,not_a_number,3.5,631.75',
        'MSFT,2024-03-20,300,2,600',
      ].join('\n');

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('VOO');
      expect(result[1].ticker).toBe('MSFT');
    });

    it('skips rows with insufficient fields', () => {
      const csv = [
        'ticker,date,price_per_share,shares,total_amount',
        'VOO,2024-01-10,400,1,400',
        'AAPL,2024-02-15',
        'MSFT,2024-03-20,300,2,600',
      ].join('\n');

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('VOO');
      expect(result[1].ticker).toBe('MSFT');
    });

    it('handles Windows-style line endings (CRLF)', () => {
      const csv = 'ticker,date,price_per_share,shares,total_amount\r\nVOO,2024-01-10,400,1,400\r\nAAPL,2024-02-15,180,2,360';

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('VOO');
      expect(result[1].ticker).toBe('AAPL');
    });

    it('handles decimal precision in import', () => {
      const csv = [
        'ticker,date,price_per_share,shares,total_amount',
        'VOO,2024-01-10,123.456789,0.123456,15.24',
      ].join('\n');

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(1);
      expect(result[0].price_per_share).toBeCloseTo(123.456789, 6);
      expect(result[0].shares).toBeCloseTo(0.123456, 6);
      expect(result[0].total_amount).toBeCloseTo(15.24, 2);
    });

    it('skips empty lines', () => {
      const csv = [
        'ticker,date,price_per_share,shares,total_amount',
        'VOO,2024-01-10,400,1,400',
        '',
        '   ',
        'AAPL,2024-02-15,180,2,360',
      ].join('\n');

      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const result = service.importFromCSV(Buffer.from(csv, 'utf-8'));

      expect(result).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────────────
  // CSV Round-trip (Property 10)
  // ────────────────────────────────────────────────────────────

  describe('CSV round-trip', () => {
    it('export then import produces equivalent data', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'VOO', transactionDate: '2024-01-10', pricePerShare: 400.25, shares: 1.5, totalAmount: 600.375 }),
        makeTransaction({ tickerSymbol: 'AAPL', transactionDate: '2024-02-15', pricePerShare: 180.5, shares: 3.123456, totalAmount: 563.89 }),
        makeTransaction({ tickerSymbol: 'MSFT', transactionDate: '2024-03-20', pricePerShare: 420, shares: 2, totalAmount: 840 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      // Export to CSV
      const csvBuffer = await service.exportToCSV({ format: 'csv' });

      // Import back
      const imported = service.importFromCSV(csvBuffer);

      expect(imported).toHaveLength(3);

      for (let i = 0; i < transactions.length; i++) {
        expect(imported[i].ticker).toBe(transactions[i].tickerSymbol);
        expect(imported[i].date).toBe(transactions[i].transactionDate);
        expect(imported[i].price_per_share).toBeCloseTo(transactions[i].pricePerShare, 10);
        expect(imported[i].shares).toBeCloseTo(transactions[i].shares, 10);
        expect(imported[i].total_amount).toBeCloseTo(transactions[i].totalAmount, 10);
      }
    });

    it('round-trip preserves data for single transaction', async () => {
      const transactions = [
        makeTransaction({ tickerSymbol: 'QQQM', transactionDate: '2023-12-01', pricePerShare: 165.99, shares: 10, totalAmount: 1659.9 }),
      ];
      const provider = new MockTransactionProvider(transactions);
      const service = new ExportService(provider);

      const csvBuffer = await service.exportToCSV({ format: 'csv' });
      const imported = service.importFromCSV(csvBuffer);

      expect(imported).toHaveLength(1);
      expect(imported[0].ticker).toBe('QQQM');
      expect(imported[0].date).toBe('2023-12-01');
      expect(imported[0].price_per_share).toBe(165.99);
      expect(imported[0].shares).toBe(10);
      expect(imported[0].total_amount).toBe(1659.9);
    });

    it('round-trip with empty data', async () => {
      const provider = new MockTransactionProvider([]);
      const service = new ExportService(provider);

      const csvBuffer = await service.exportToCSV({ format: 'csv' });
      const imported = service.importFromCSV(csvBuffer);

      expect(imported).toEqual([]);
    });
  });

  // ────────────────────────────────────────────────────────────
  // RepositoryTransactionProvider
  // ────────────────────────────────────────────────────────────

  describe('RepositoryTransactionProvider', () => {
    it('fetches transactions from repository with filters', async () => {
      const repo = new InMemoryTransactionRepository();
      await repo.create({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-01-10',
        pricePerShare: 400,
        shares: 1,
        totalAmount: 400,
      });
      await repo.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-02-15',
        pricePerShare: 180,
        shares: 2,
        totalAmount: 360,
      });

      const provider = new RepositoryTransactionProvider(repo);
      const result = await provider.getFilteredTransactions({
        format: 'csv',
        tickerSymbol: 'VOO',
      });

      expect(result).toHaveLength(1);
      expect(result[0].tickerSymbol).toBe('VOO');
    });

    it('returns all transactions when no filters applied', async () => {
      const repo = new InMemoryTransactionRepository();
      await repo.create({
        userId: 'user-1',
        tickerSymbol: 'VOO',
        transactionDate: '2024-01-10',
        pricePerShare: 400,
        shares: 1,
        totalAmount: 400,
      });
      await repo.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-02-15',
        pricePerShare: 180,
        shares: 2,
        totalAmount: 360,
      });

      const provider = new RepositoryTransactionProvider(repo);
      const result = await provider.getFilteredTransactions({ format: 'csv' });

      expect(result).toHaveLength(2);
    });
  });
});
