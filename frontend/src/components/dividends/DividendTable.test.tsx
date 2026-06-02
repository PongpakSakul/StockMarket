import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DividendTable, { type DividendTableProps } from './DividendTable';
import type { Dividend } from '../../store/slices/dividendsSlice';

function createDividend(overrides: Partial<Dividend> = {}): Dividend {
  return {
    id: '1',
    userId: 'user-1',
    tickerSymbol: 'VOO',
    dividendDate: '2024-03-15',
    amountPerShare: 1.5432,
    totalAmount: 7.72,
    sharesHeld: 5,
    createdAt: '2024-03-15T10:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    ...overrides,
  };
}

const sampleDividends: Dividend[] = [
  createDividend({ id: '1', tickerSymbol: 'VOO', dividendDate: '2024-03-15', amountPerShare: 1.5432, totalAmount: 7.72 }),
  createDividend({ id: '2', tickerSymbol: 'QQQM', dividendDate: '2024-06-15', amountPerShare: 0.6789, totalAmount: 3.39 }),
  createDividend({ id: '3', tickerSymbol: 'AAPL', dividendDate: '2024-09-01', amountPerShare: 0.25, totalAmount: 0.75 }),
];

function renderTable(props: Partial<DividendTableProps> = {}) {
  const defaultProps: DividendTableProps = {
    dividends: sampleDividends,
    totalCount: 3,
    page: 1,
    pageSize: 20,
    onPageChange: vi.fn(),
    onFilterChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  };
  return {
    ...render(<DividendTable {...defaultProps} />),
    onPageChange: defaultProps.onPageChange as ReturnType<typeof vi.fn>,
    onFilterChange: defaultProps.onFilterChange as ReturnType<typeof vi.fn>,
    onEdit: defaultProps.onEdit as ReturnType<typeof vi.fn>,
    onDelete: defaultProps.onDelete as ReturnType<typeof vi.fn>,
  };
}

describe('DividendTable', () => {
  describe('rendering', () => {
    it('renders table with correct column headers', () => {
      renderTable();

      expect(screen.getByRole('table', { name: 'Dividends table' })).toBeInTheDocument();
      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(5);
      expect(headers[0]).toHaveTextContent('Ticker');
      expect(headers[1]).toHaveTextContent('Date');
      expect(headers[2]).toHaveTextContent('Amount/Share');
      expect(headers[3]).toHaveTextContent('Total Amount');
      expect(headers[4]).toHaveTextContent('Actions');
    });

    it('renders dividend data in rows', () => {
      renderTable();

      expect(screen.getByText('VOO')).toBeInTheDocument();
      expect(screen.getByText('2024-03-15')).toBeInTheDocument();
      expect(screen.getByText('$1.543200')).toBeInTheDocument();
      expect(screen.getByText('$7.72')).toBeInTheDocument();

      expect(screen.getByText('QQQM')).toBeInTheDocument();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('renders empty state when no dividends', () => {
      renderTable({ dividends: [], totalCount: 0 });

      expect(screen.getByText('No dividends found.')).toBeInTheDocument();
    });

    it('renders filter inputs', () => {
      renderTable();

      expect(screen.getByLabelText('Ticker')).toBeInTheDocument();
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply Filters' })).toBeInTheDocument();
    });
  });

  describe('cumulative dividend summary', () => {
    it('displays cumulative dividends total from data', () => {
      renderTable();

      const summaryRegion = screen.getByRole('region', { name: 'Dividend summary' });
      // Total: 7.72 + 3.39 + 0.75 = 11.86
      expect(summaryRegion).toHaveTextContent('$11.86');
    });

    it('displays cumulative dividends from summary prop when provided', () => {
      renderTable({
        summary: {
          totalDividends: 150.50,
          dividendsByTicker: { VOO: 100.0, QQQM: 50.5 },
        },
      });

      const summaryRegion = screen.getByRole('region', { name: 'Dividend summary' });
      expect(summaryRegion).toHaveTextContent('$150.50');
      expect(summaryRegion).toHaveTextContent('VOO: $100.00');
      expect(summaryRegion).toHaveTextContent('QQQM: $50.50');
    });

    it('displays Cumulative Dividends label', () => {
      renderTable();

      expect(screen.getByText('Cumulative Dividends')).toBeInTheDocument();
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

  describe('pagination', () => {
    it('does not render pagination when totalPages is 1', () => {
      renderTable({ totalCount: 3, pageSize: 20 });

      expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
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
    it('calls onEdit with the dividend when Edit is clicked', () => {
      const { onEdit } = renderTable();

      fireEvent.click(screen.getByLabelText('Edit dividend VOO on 2024-03-15'));

      expect(onEdit).toHaveBeenCalledWith(sampleDividends[0]);
    });
  });

  describe('delete action with confirmation', () => {
    it('shows confirmation dialog when Delete is clicked', () => {
      renderTable();

      fireEvent.click(screen.getByLabelText('Delete dividend VOO on 2024-03-15'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this dividend/)).toBeInTheDocument();
    });

    it('calls onDelete when confirming deletion', () => {
      const { onDelete } = renderTable();

      fireEvent.click(screen.getByLabelText('Delete dividend VOO on 2024-03-15'));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('closes dialog without deleting when Cancel is clicked', () => {
      const { onDelete } = renderTable();

      fireEvent.click(screen.getByLabelText('Delete dividend VOO on 2024-03-15'));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible table label', () => {
      renderTable();
      expect(screen.getByRole('table', { name: 'Dividends table' })).toBeInTheDocument();
    });

    it('has accessible filter group', () => {
      renderTable();
      expect(screen.getByRole('group', { name: 'Dividend filters' })).toBeInTheDocument();
    });

    it('delete confirmation dialog has aria-modal', () => {
      renderTable();

      fireEvent.click(screen.getByLabelText('Delete dividend VOO on 2024-03-15'));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });
});
