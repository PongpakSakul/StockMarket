// Feature: stock-portfolio-tracker, Property 9: Sorting produces correct order

import fc from 'fast-check';
import { TransactionFilters, Transaction } from '../types';
import {
  InMemoryTransactionRepository,
  CreateTransactionDTO,
} from '../repositories/transaction-repository';
import { TransactionService } from './transaction-service';

/**
 * Arbitrary generator for a valid CreateTransactionDTO.
 * Uses known tickers so the service won't reject them during validation.
 */
const createTransactionDTOArb: fc.Arbitrary<CreateTransactionDTO> = fc.record({
  userId: fc.constant('user-1'),
  tickerSymbol: fc.constantFrom('AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'VOO', 'QQQ'),
  transactionDate: fc
    .date({
      min: new Date('2020-01-01'),
      max: new Date('2024-12-31'),
    })
    .map((d) => d.toISOString().slice(0, 10)),
  pricePerShare: fc.integer({ min: 1, max: 99999 }).map((n) => n / 100),
  shares: fc.integer({ min: 1, max: 999999 }).map((n) => n / 1000),
  totalAmount: fc.integer({ min: 1, max: 9999999 }).map((n) => n / 100),
  source: fc.constant('manual' as const),
});

/**
 * Arbitrary for sort field and direction.
 */
const sortFieldArb = fc.constantFrom<'date' | 'ticker' | 'amount'>('date', 'ticker', 'amount');
const sortOrderArb = fc.constantFrom<'asc' | 'desc'>('asc', 'desc');

/**
 * Helper: extract the sort-key value from a Transaction given the sort field.
 */
function getSortValue(txn: Transaction, sortBy: 'date' | 'ticker' | 'amount'): string | number {
  switch (sortBy) {
    case 'date':
      return txn.transactionDate;
    case 'ticker':
      return txn.tickerSymbol;
    case 'amount':
      return txn.totalAmount;
  }
}

/**
 * Helper: check that the ordering constraint holds for an adjacent pair.
 */
function orderingHolds(
  a: string | number,
  b: string | number,
  sortOrder: 'asc' | 'desc',
): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    const cmp = a.localeCompare(b);
    return sortOrder === 'asc' ? cmp <= 0 : cmp >= 0;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return sortOrder === 'asc' ? a <= b : a >= b;
  }
  return false;
}

describe('Data Sorting (Property-Based)', () => {
  it('sorting produces correct order for every adjacent pair', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createTransactionDTOArb, { minLength: 2, maxLength: 30 }),
        sortFieldArb,
        sortOrderArb,
        async (transactionDTOs, sortBy, sortOrder) => {
          // Set up fresh repository and service for each run
          const repository = new InMemoryTransactionRepository();
          repository.clear();
          const service = new TransactionService(repository);

          // Insert all transactions
          for (const dto of transactionDTOs) {
            await repository.create(dto);
          }

          // Query with the random sort criteria
          const filters: TransactionFilters = {
            sortBy,
            sortOrder,
            page: 1,
            pageSize: 1000, // large enough to get all results in one page
          };

          const result = await service.getTransactions(filters);
          const sorted = result.data;

          // For every adjacent pair, verify the ordering constraint holds
          for (let i = 0; i < sorted.length - 1; i++) {
            const currentValue = getSortValue(sorted[i], sortBy);
            const nextValue = getSortValue(sorted[i + 1], sortBy);

            expect(orderingHolds(currentValue, nextValue, sortOrder)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
