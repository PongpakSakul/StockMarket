import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionTable, { type TransactionTableProps } from './TransactionTable';
import type { Transaction } from '../../store/slices/transactionsSlice';

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    userId: 'user-1',
    tickerSymbol: 'VOO',
    transactionDate: '2024-01-15',
    pricePerShare: 420.5,
    shares: 2.5,
    totalAmount: 1051.25,
    source: 'manual',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

const sampleTransactions: Transaction[] = [
  createTransaction({ id: '1', tickerSymbol: 'VOO', transactionDate: '2024-01-15', pricePerShare: 420.5, shares: 2.5, totalAmount: 1051.25 }),
  createTransaction({ id: '2', tickerSymbol: 'QQQM', transactionDate: '2024-02-10', pricePerShare: 170.0, shares: 5, totalAmount: 850.0 }),
  createTransaction({ id: '3', tickerSymbol: 'AAPL', transactionDate: '2024-03-01', pricePerShare: 180.25, shares: 3, totalAmount: 540.75 }),
];

function renderTable(props: Partial<TransactionTableProps> = {}) {
  const defaultProps: TransactionTableProps = {
    transactions: sampleTransactions,
    totalCount: 3,
    page: 1,
    pageSize: 20,
    onPageChange: vi.fn(),
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  return {
    ...render(<TransactionTable {...defaultProps} />),
    onPageChange: defaultProps.onPageChange as ReturnType<typeof vi.fn>,
    onFilterChange: defaultProps.onFilterChange as ReturnType<typeof vi.fn>,
    onSortChange: defaultProps.onSortChange as ReturnType<typeof vi.fn>,
    onEdit: defaultProps.onEdit as ReturnType<typeof vi.fn>,
    onDelete: defaultProps.onDelete as ReturnType<typeof vi.fn>,
  };
}

describe('TransactionTable', () => {
  describe('rendering', () => {
    it('renders table with correct column headers', () => {
      renderTable();

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(6);
      expect(headers[0]).toHaveTextContent('Ticker');
      expect(headers[1]).toHaveTextContent('Date');
      expect(headers[2]).toHaveTextContent('Price/Share');
      expect(headers[3]).toHaveTextContent('Shares');
      expect(headers[4]).toHaveTextContent('Total Amount');
      expect(headers[5]).toHaveTextContent('Actions');
    });

    it('renders transaction data in rows', () => {
      renderTable();

      expect(screen.getByText('VOO')).toBeInTheDocument();
      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('$420.50')).toBeInTheDocument();
      expect(screen.getByText('2.5')).toBeInTheDocument();
      expect(screen.getByText('$1051.25')).toBeInTheDocument();

      expect(screen.getByText('QQQM')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('renders empty state when no transactions', () => {
      renderTable({ transactions: [], totalCount: 0 });

      expect(screen.getByText('No transactions found.')).toBeInTheDocument();
    });

    it('renders filter inputs', () => {
      renderTable();

      expect(screen.getByLabelText('Ticker')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply Filters' })).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('calls onFilterChange with ticker filter when Apply Filters is clicked', () => {
      const { onFilterChange } = renderTable();

      fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'voo' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

      expect(onFilterChange).toHaveBeenCalledWith({ tickerSymbol: 'VOO' });
    });

    it('calls onFilterChange with date range filters', () => {
      const { onFilterChange } = renderTable();

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-01' } });
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-06-30' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

      expect(onFilterChange).toHaveBeenCalledWith({
        fromDate: '2024-01-01',
        toDate: '2024-06-30',
      });
    });

    it('calls onFilterChange with all filters combined', () => {
      const { onFilterChange } = renderTable();

      fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'AAPL' } });
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-01-01' } });
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-12-31' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

      expect(onFilterChange).toHaveBeenCalledWith({
        tickerSymbol: 'AAPL',
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      });
    });

    it('omits empty filter values', () => {
      const { onFilterChange } = renderTable();

      fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

      expect(onFilterChange).toHaveBeenCalledWith({});
    });
  });

  describe('sorting', () => {
    it('calls onSortChange when clicking Ticker header', () => {
      const { onSortChange } = renderTable();

      const headers = screen.getAllByRole('columnheader');
      fireEvent.click(headers[0]); // Ticker header

      expect(onSortChange).toHaveBeenCalledWith('ticker', 'asc');
    });

    it('calls onSortChange when clicking Date header', () => {
      const { onSortChange } = renderTable();

      const headers = screen.getAllByRole('columnheader');
      fireEvent.click(headers[1]); // Date header

      // Default sort is 'date' desc, so clicking toggles to asc
      expect(onSortChange).toHaveBeenCalledWith('date', 'asc');
    });

    it('calls onSortChange when clicking Total Amount header', () => {
      const { onSortChange } = renderTable();

      const headers = screen.getAllByRole('columnheader');
      fireEvent.click(headers[4]); // Total Amount header

      expect(onSortChange).toHaveBeenCalledWith('amount', 'asc');
    });

    it('toggles sort order when clicking same column twice', () => {
      const { onSortChange } = renderTable();

      const headers = screen.getAllByRole('columnheader');

      // First click on Ticker: asc
      fireEvent.click(headers[0]);
      expect(onSortChange).toHaveBeenCalledWith('ticker', 'asc');

      // Second click on Ticker: desc
      fireEvent.click(headers[0]);
      expect(onSortChange).toHaveBeenCalledWith('ticker', 'desc');
    });

    it('displays sort indicator on active column', () => {
      renderTable();

      // Default sort is 'date' desc
      const headers = screen.getAllByRole('columnheader');
      expect(headers[1].textContent).toContain('▼');
    });
  });

  describe('pagination', () => {
    it('does not render pagination when totalPages is 1', () => {
      renderTable({ totalCount: 3, pageSize: 20 });

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('renders pagination when totalPages > 1', () => {
      renderTable({ totalCount: 50, pageSize: 20, page: 1 });

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('disables Previous button on first page', () => {
      renderTable({ totalCount: 50, pageSize: 20, page: 1 });

      expect(screen.getByLabelText('Previous page')).toBeDisabled();
    });

    it('disables Next button on last page', () => {
      renderTable({ totalCount: 50, pageSize: 20, page: 3 });

      expect(screen.getByLabelText('Next page')).toBeDisabled();
    });

    it('calls onPageChange with next page when Next is clicked', () => {
      const { onPageChange } = renderTable({ totalCount: 50, pageSize: 20, page: 1 });

      fireEvent.click(screen.getByLabelText('Next page'));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with previous page when Previous is clicked', () => {
      const { onPageChange } = renderTable({ totalCount: 50, pageSize: 20, page: 2 });

      fireEvent.click(screen.getByLabelText('Previous page'));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('edit action', () => {
    it('calls onEdit with the transaction when Edit is clicked', () => {
      const { onEdit } = renderTable();

      fireEvent.click(screen.getByLabelText('Edit transaction VOO on 2024-01-15'));

      expect(onEdit).toHaveBeenCalledWith(sampleTransactions[0]);
    });
  });

  describe('delete action with confirmation', () => {
    it('shows confirmation dialog when Delete is clicked', () => {
      renderTable();

      fireEvent.click(screen.getByLabelText('Delete transaction VOO on 2024-01-15'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this transaction/)).toBeInTheDocument();
    });

    it('calls onDelete when confirming deletion', () => {
      const { onDelete } = renderTable();

      fireEvent.click(screen.getByLabelText('Delete transaction VOO on 2024-01-15'));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('closes dialog without deleting when Cancel is clicked', () => {
      const { onDelete } = renderTable();

      fireEvent.click(screen.getByLabelText('Delete transaction VOO on 2024-01-15'));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible table label', () => {
      renderTable();
      expect(screen.getByRole('table', { name: 'Transactions table' })).toBeInTheDocument();
    });

    it('has accessible filter group', () => {
      renderTable();
      expect(screen.getByRole('group', { name: 'Transaction filters' })).toBeInTheDocument();
    });

    it('has aria-sort on sortable columns', () => {
      renderTable();

      const dateHeader = screen.getByRole('columnheader', { name: /Date/ });
      expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('delete confirmation dialog has aria-modal', () => {
      renderTable();

      fireEvent.click(screen.getByLabelText('Delete transaction VOO on 2024-01-15'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });
});
