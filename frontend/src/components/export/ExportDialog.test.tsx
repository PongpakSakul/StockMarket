import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExportDialog, { type ExportDialogProps } from './ExportDialog';

// Mock the apiDownload function
vi.mock('../../store/api', () => ({
  apiDownload: vi.fn(),
}));

import { apiDownload } from '../../store/api';

const mockApiDownload = apiDownload as ReturnType<typeof vi.fn>;

function renderDialog(props: Partial<ExportDialogProps> = {}) {
  const defaultProps: ExportDialogProps = {
    visible: true,
    onClose: vi.fn(),
    ...props,
  };
  return {
    ...render(<ExportDialog {...defaultProps} />),
    onClose: defaultProps.onClose as ReturnType<typeof vi.fn>,
  };
}

describe('ExportDialog', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURLMock = vi.fn(() => 'blob:http://localhost/fake-url');
    revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders the dialog when visible is true', () => {
      renderDialog({ visible: true });
      expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
    });

    it('does not render when visible is false', () => {
      renderDialog({ visible: false });
      expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog title', () => {
      renderDialog();
      expect(screen.getByText('Export Transactions')).toBeInTheDocument();
    });

    it('renders format radio buttons for CSV and Excel', () => {
      renderDialog();
      expect(screen.getByTestId('format-csv')).toBeInTheDocument();
      expect(screen.getByTestId('format-xlsx')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument();
    });

    it('renders ticker symbol input', () => {
      renderDialog();
      expect(screen.getByTestId('filter-ticker')).toBeInTheDocument();
      expect(screen.getByLabelText('Ticker Symbol (optional)')).toBeInTheDocument();
    });

    it('renders date range inputs', () => {
      renderDialog();
      expect(screen.getByTestId('filter-from-date')).toBeInTheDocument();
      expect(screen.getByTestId('filter-to-date')).toBeInTheDocument();
      expect(screen.getByLabelText('From Date')).toBeInTheDocument();
      expect(screen.getByLabelText('To Date')).toBeInTheDocument();
    });

    it('renders Export and Cancel buttons', () => {
      renderDialog();
      expect(screen.getByTestId('export-submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('export-cancel-button')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('has correct aria attributes for accessibility', () => {
      renderDialog();
      const dialog = screen.getByTestId('export-dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Export Transactions');
    });
  });

  describe('format selection', () => {
    it('defaults to CSV format', () => {
      renderDialog();
      const csvRadio = screen.getByTestId('format-csv') as HTMLInputElement;
      const xlsxRadio = screen.getByTestId('format-xlsx') as HTMLInputElement;
      expect(csvRadio.checked).toBe(true);
      expect(xlsxRadio.checked).toBe(false);
    });

    it('allows selecting Excel format', () => {
      renderDialog();
      const xlsxRadio = screen.getByTestId('format-xlsx') as HTMLInputElement;
      fireEvent.click(xlsxRadio);
      expect(xlsxRadio.checked).toBe(true);
      expect((screen.getByTestId('format-csv') as HTMLInputElement).checked).toBe(false);
    });

    it('allows switching back to CSV format', () => {
      renderDialog();
      const csvRadio = screen.getByTestId('format-csv') as HTMLInputElement;
      const xlsxRadio = screen.getByTestId('format-xlsx') as HTMLInputElement;

      fireEvent.click(xlsxRadio);
      expect(xlsxRadio.checked).toBe(true);

      fireEvent.click(csvRadio);
      expect(csvRadio.checked).toBe(true);
      expect(xlsxRadio.checked).toBe(false);
    });
  });

  describe('filter inputs', () => {
    it('allows entering ticker symbol', () => {
      renderDialog();
      const tickerInput = screen.getByTestId('filter-ticker') as HTMLInputElement;
      fireEvent.change(tickerInput, { target: { value: 'VOO' } });
      expect(tickerInput.value).toBe('VOO');
    });

    it('allows setting from date', () => {
      renderDialog();
      const fromDate = screen.getByTestId('filter-from-date') as HTMLInputElement;
      fireEvent.change(fromDate, { target: { value: '2024-01-01' } });
      expect(fromDate.value).toBe('2024-01-01');
    });

    it('allows setting to date', () => {
      renderDialog();
      const toDate = screen.getByTestId('filter-to-date') as HTMLInputElement;
      fireEvent.change(toDate, { target: { value: '2024-12-31' } });
      expect(toDate.value).toBe('2024-12-31');
    });

    it('filters are optional (export works without them)', async () => {
      const blob = new Blob(['ticker,date\nVOO,2024-01-01'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalledWith('/export/transactions', {
          format: 'csv',
          ticker: undefined,
          from: undefined,
          to: undefined,
        });
      });
    });
  });

  describe('export submission', () => {
    it('calls apiDownload with correct params for CSV export', async () => {
      const blob = new Blob(['data'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      renderDialog();

      fireEvent.change(screen.getByTestId('filter-ticker'), { target: { value: 'VOO' } });
      fireEvent.change(screen.getByTestId('filter-from-date'), { target: { value: '2024-01-01' } });
      fireEvent.change(screen.getByTestId('filter-to-date'), { target: { value: '2024-06-30' } });
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalledWith('/export/transactions', {
          format: 'csv',
          ticker: 'VOO',
          from: '2024-01-01',
          to: '2024-06-30',
        });
      });
    });

    it('calls apiDownload with xlsx format when Excel is selected', async () => {
      const blob = new Blob(['data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      mockApiDownload.mockResolvedValue(blob);

      renderDialog();

      fireEvent.click(screen.getByTestId('format-xlsx'));
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalledWith('/export/transactions', expect.objectContaining({
          format: 'xlsx',
        }));
      });
    });

    it('uppercases ticker symbol in API call', async () => {
      const blob = new Blob(['data'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      renderDialog();

      fireEvent.change(screen.getByTestId('filter-ticker'), { target: { value: 'voo' } });
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(mockApiDownload).toHaveBeenCalledWith('/export/transactions', expect.objectContaining({
          ticker: 'VOO',
        }));
      });
    });

    it('shows loading state while exporting', async () => {
      let resolvePromise: (value: Blob) => void;
      const pendingPromise = new Promise<Blob>((resolve) => {
        resolvePromise = resolve;
      });
      mockApiDownload.mockReturnValue(pendingPromise);

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
        expect(screen.getByTestId('export-submit-button')).toBeDisabled();
      });

      // Resolve to clean up
      resolvePromise!(new Blob(['data'], { type: 'text/csv' }));
    });

    it('triggers file download on successful export', async () => {
      const blob = new Blob(['ticker,date\nVOO,2024-01-01'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalledWith(blob);
        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();
        expect(revokeObjectURLMock).toHaveBeenCalled();
      });

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('uses csv extension for CSV format downloads', async () => {
      const blob = new Blob(['data'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      let downloadedFilename = '';
      const originalAppendChild = document.body.appendChild.bind(document.body);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          downloadedFilename = node.download;
        }
        return originalAppendChild(node);
      });

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(downloadedFilename).toBe('transactions_export.csv');
      });

      appendChildSpy.mockRestore();
    });

    it('uses xlsx extension for Excel format downloads', async () => {
      const blob = new Blob(['data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      mockApiDownload.mockResolvedValue(blob);

      let downloadedFilename = '';
      const originalAppendChild = document.body.appendChild.bind(document.body);
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          downloadedFilename = node.download;
        }
        return originalAppendChild(node);
      });

      renderDialog();
      fireEvent.click(screen.getByTestId('format-xlsx'));
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(downloadedFilename).toBe('transactions_export.xlsx');
      });

      appendChildSpy.mockRestore();
    });

    it('closes dialog after successful export', async () => {
      const blob = new Blob(['data'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      const { onClose } = renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('cancel behavior', () => {
    it('calls onClose when cancel button is clicked', () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByTestId('export-cancel-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('resets form state on cancel', () => {
      const { onClose, rerender } = renderDialog();

      // Set some filter values
      fireEvent.change(screen.getByTestId('filter-ticker'), { target: { value: 'VOO' } });
      fireEvent.click(screen.getByTestId('format-xlsx'));

      // Close
      fireEvent.click(screen.getByTestId('export-cancel-button'));
      expect(onClose).toHaveBeenCalled();

      // Re-render as visible (simulating re-open)
      rerender(<ExportDialog visible={true} onClose={onClose} />);

      // After reset, values should be back to defaults
      const csvRadio = screen.getByTestId('format-csv') as HTMLInputElement;
      expect(csvRadio.checked).toBe(true);
    });
  });

  describe('empty results notification', () => {
    it('shows empty result alert when export returns zero-size blob', async () => {
      const emptyBlob = new Blob([], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(emptyBlob);

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('empty-result-alert')).toBeInTheDocument();
        expect(screen.getByText('No transactions found matching the selected filters.')).toBeInTheDocument();
      });
    });

    it('shows empty result alert when backend returns JSON with NO_DATA code', async () => {
      const jsonContent = JSON.stringify({ code: 'NO_DATA', message: 'No data found' });
      const jsonBlob = {
        size: jsonContent.length,
        type: 'application/json',
        text: () => Promise.resolve(jsonContent),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        slice: () => new Blob(),
        stream: () => new ReadableStream(),
      } as unknown as Blob;
      mockApiDownload.mockResolvedValue(jsonBlob);

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('empty-result-alert')).toBeInTheDocument();
      });
    });

    it('shows empty result alert when API throws NO_DATA error', async () => {
      mockApiDownload.mockRejectedValue({ code: 'NO_DATA', message: 'No data' });

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('empty-result-alert')).toBeInTheDocument();
      });
    });

    it('does not close dialog when results are empty', async () => {
      const emptyBlob = new Blob([], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(emptyBlob);

      const { onClose } = renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('empty-result-alert')).toBeInTheDocument();
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('shows error alert when API call fails', async () => {
      mockApiDownload.mockRejectedValue({ code: 'UNKNOWN_ERROR', message: 'Server error' });

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error-alert')).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });

    it('shows generic error message when error has no message', async () => {
      mockApiDownload.mockRejectedValue({});

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error-alert')).toBeInTheDocument();
        expect(screen.getByText('Failed to export data. Please try again.')).toBeInTheDocument();
      });
    });

    it('does not close dialog on error', async () => {
      mockApiDownload.mockRejectedValue({ message: 'Network error' });

      const { onClose } = renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error-alert')).toBeInTheDocument();
      });

      expect(onClose).not.toHaveBeenCalled();
    });

    it('clears error when retrying export', async () => {
      // First call fails
      mockApiDownload.mockRejectedValueOnce({ message: 'Network error' });

      renderDialog();
      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error-alert')).toBeInTheDocument();
      });

      // Second call succeeds
      const blob = new Blob(['data'], { type: 'text/csv' });
      mockApiDownload.mockResolvedValue(blob);

      fireEvent.click(screen.getByTestId('export-submit-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('export-error-alert')).not.toBeInTheDocument();
      });
    });
  });
});
