import { DimeImportService, ImportResult } from './dime-import-service';
import { InMemoryTransactionRepository } from '../repositories/transaction-repository';
import { StructuredTransaction } from '../types';

describe('DimeImportService', () => {
  let repository: InMemoryTransactionRepository;
  let service: DimeImportService;

  beforeEach(() => {
    repository = new InMemoryTransactionRepository();
    service = new DimeImportService(repository, 'user-1');
  });

  // ──────────────────────────────────────────────────────────
  // parseFile — CSV
  // ──────────────────────────────────────────────────────────

  describe('parseFile (CSV)', () => {
    it('should parse a valid CSV file with correct headers', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,150.50,10,1505.00',
        'VOO,2024-02-20,420.00,5,2100.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0]).toEqual({
        ticker: 'AAPL',
        date: '2024-01-15',
        price_per_share: 150.50,
        shares: 10,
        total_amount: 1505.00,
      });
      expect(result.transactions[1]).toEqual({
        ticker: 'VOO',
        date: '2024-02-20',
        price_per_share: 420.00,
        shares: 5,
        total_amount: 2100.00,
      });
    });

    it('should handle CSV with different column order', () => {
      const csv = [
        'date,ticker,shares,price,total',
        '2024-01-15,AAPL,10,150.50,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(1);
      expect(result.transactions[0]).toEqual({
        ticker: 'AAPL',
        date: '2024-01-15',
        price_per_share: 150.50,
        shares: 10,
        total_amount: 1505.00,
      });
    });

    it('should convert ticker to uppercase', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'aapl,2024-01-15,150.50,10,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.transactions[0].ticker).toBe('AAPL');
    });

    it('should handle CSV with Windows line endings (CRLF)', () => {
      const csv = 'ticker,date,price,shares,total\r\nAAPL,2024-01-15,150.50,10,1505.00\r\n';

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(1);
      expect(result.transactions[0].ticker).toBe('AAPL');
    });

    it('should report error for rows with missing fields', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,150.50,,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[0].message).toContain('Missing required fields');
    });

    it('should report error for rows with invalid numeric values', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,abc,10,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid numeric values');
    });

    it('should report error for rows with negative values', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,-150.50,10,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Numeric values must be positive');
    });

    it('should report error for rows with invalid date format', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,15-01-2024,150.50,10,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should reject CSV with invalid headers', () => {
      const csv = [
        'symbol,transaction_date,cost,quantity,amount',
        'AAPL,2024-01-15,150.50,10,1505.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid CSV headers');
    });

    it('should handle empty file', () => {
      const result = service.parseFile(Buffer.from(''), 'csv');

      expect(result.totalRows).toBe(0);
      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should handle file with only headers', () => {
      const csv = 'ticker,date,price,shares,total';

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.totalRows).toBe(0);
      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip empty lines in CSV', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,150.50,10,1505.00',
        '',
        'VOO,2024-02-20,420.00,5,2100.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.successfulRows).toBe(2);
      expect(result.transactions).toHaveLength(2);
    });

    it('should handle partial success — some rows valid, some invalid', () => {
      const csv = [
        'ticker,date,price,shares,total',
        'AAPL,2024-01-15,150.50,10,1505.00',
        'BAD,invalid-date,abc,10,1505.00',
        'VOO,2024-02-20,420.00,5,2100.00',
      ].join('\n');

      const result = service.parseFile(Buffer.from(csv), 'csv');

      expect(result.totalRows).toBe(3);
      expect(result.successfulRows).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.transactions).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────
  // parseFile — JSON
  // ──────────────────────────────────────────────────────────

  describe('parseFile (JSON)', () => {
    it('should parse a valid JSON array', () => {
      const data = [
        { ticker: 'AAPL', date: '2024-01-15', price: 150.50, shares: 10, total: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price: 420.00, shares: 5, total: 2100.00 },
      ];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.transactions[0]).toEqual({
        ticker: 'AAPL',
        date: '2024-01-15',
        price_per_share: 150.50,
        shares: 10,
        total_amount: 1505.00,
      });
    });

    it('should convert ticker to uppercase in JSON', () => {
      const data = [{ ticker: 'aapl', date: '2024-01-15', price: 150.50, shares: 10, total: 1505.00 }];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.transactions[0].ticker).toBe('AAPL');
    });

    it('should handle numeric values as strings in JSON', () => {
      const json = JSON.stringify([
        { ticker: 'AAPL', date: '2024-01-15', price: '150.50', shares: '10', total: '1505.00' },
      ]);

      const result = service.parseFile(Buffer.from(json), 'json');

      expect(result.successfulRows).toBe(1);
      expect(result.transactions[0].price_per_share).toBe(150.50);
    });

    it('should report error for invalid JSON', () => {
      const result = service.parseFile(Buffer.from('not valid json{'), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid JSON format');
    });

    it('should report error when JSON is not an array', () => {
      const result = service.parseFile(Buffer.from('{"ticker": "AAPL"}'), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('must be an array');
    });

    it('should report error for items missing required fields', () => {
      const data = [{ ticker: 'AAPL', price: 150.50, shares: 10, total: 1505.00 }];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Missing required fields');
    });

    it('should report error for items with invalid numeric values', () => {
      const data = [{ ticker: 'AAPL', date: '2024-01-15', price: 'abc', shares: 10, total: 1505.00 }];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid numeric values');
    });

    it('should report error for items with negative values', () => {
      const data = [{ ticker: 'AAPL', date: '2024-01-15', price: -150.50, shares: 10, total: 1505.00 }];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Numeric values must be positive');
    });

    it('should report error for items with invalid date', () => {
      const data = [{ ticker: 'AAPL', date: '2024-13-45', price: 150.50, shares: 10, total: 1505.00 }];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Invalid date format');
    });

    it('should handle empty JSON array', () => {
      const result = service.parseFile(Buffer.from('[]'), 'json');

      expect(result.totalRows).toBe(0);
      expect(result.successfulRows).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty file for JSON', () => {
      const result = service.parseFile(Buffer.from(''), 'json');

      expect(result.totalRows).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should handle partial success in JSON — some items valid, some invalid', () => {
      const data = [
        { ticker: 'AAPL', date: '2024-01-15', price: 150.50, shares: 10, total: 1505.00 },
        { ticker: 'BAD', date: 'not-a-date', price: 100, shares: 5, total: 500 },
        { ticker: 'VOO', date: '2024-02-20', price: 420.00, shares: 5, total: 2100.00 },
      ];

      const result = service.parseFile(Buffer.from(JSON.stringify(data)), 'json');

      expect(result.totalRows).toBe(3);
      expect(result.successfulRows).toBe(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────
  // detectDuplicates
  // ──────────────────────────────────────────────────────────

  describe('detectDuplicates', () => {
    it('should detect duplicates matching on ticker + date + price + shares', async () => {
      // Seed an existing transaction
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates).toHaveLength(1);
      expect(result.unique).toHaveLength(0);
      expect(result.duplicates[0].imported).toEqual(imported[0]);
      expect(result.duplicates[0].existing.tickerSymbol).toBe('AAPL');
    });

    it('should identify unique transactions when no match exists', async () => {
      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates).toHaveLength(0);
      expect(result.unique).toHaveLength(1);
    });

    it('should not match when price differs', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 151.00, shares: 10, total_amount: 1510.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates).toHaveLength(0);
      expect(result.unique).toHaveLength(1);
    });

    it('should not match when shares differ', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 20, total_amount: 3010.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates).toHaveLength(0);
      expect(result.unique).toHaveLength(1);
    });

    it('should handle mix of duplicates and unique transactions', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.00, shares: 5, total_amount: 2100.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates).toHaveLength(1);
      expect(result.unique).toHaveLength(1);
      expect(result.unique[0].ticker).toBe('VOO');
    });

    it('should ensure duplicates + unique equals total imported', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const imported: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.00, shares: 5, total_amount: 2100.00 },
        { ticker: 'QQQM', date: '2024-03-10', price_per_share: 180.00, shares: 8, total_amount: 1440.00 },
      ];

      const result = await service.detectDuplicates(imported);

      expect(result.duplicates.length + result.unique.length).toBe(imported.length);
    });
  });

  // ──────────────────────────────────────────────────────────
  // importTransactions
  // ──────────────────────────────────────────────────────────

  describe('importTransactions', () => {
    it('should import unique transactions successfully', async () => {
      const transactions: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.00, shares: 5, total_amount: 2100.00 },
      ];

      const result = await service.importTransactions(transactions, false);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.overwritten).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip duplicates when overwriteDuplicates is false', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const transactions: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.00, shares: 5, total_amount: 2100.00 },
      ];

      const result = await service.importTransactions(transactions, false);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.overwritten).toBe(0);
    });

    it('should overwrite duplicates when overwriteDuplicates is true', async () => {
      await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const transactions: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
        { ticker: 'VOO', date: '2024-02-20', price_per_share: 420.00, shares: 5, total_amount: 2100.00 },
      ];

      const result = await service.importTransactions(transactions, true);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.overwritten).toBe(1);
    });

    it('should set source to dime_import for imported transactions', async () => {
      const transactions: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
      ];

      await service.importTransactions(transactions, false);

      const allTxns = await repository.findAll({ page: 1, pageSize: 100 });
      expect(allTxns.data[0].source).toBe('dime_import');
    });

    it('should handle import with no transactions', async () => {
      const result = await service.importTransactions([], false);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.overwritten).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update source to dime_import when overwriting', async () => {
      const created = await repository.create({
        userId: 'user-1',
        tickerSymbol: 'AAPL',
        transactionDate: '2024-01-15',
        pricePerShare: 150.50,
        shares: 10,
        totalAmount: 1505.00,
        source: 'manual',
      });

      const transactions: StructuredTransaction[] = [
        { ticker: 'AAPL', date: '2024-01-15', price_per_share: 150.50, shares: 10, total_amount: 1505.00 },
      ];

      await service.importTransactions(transactions, true);

      const updated = await repository.findById(created.id);
      expect(updated?.source).toBe('dime_import');
    });
  });
});
