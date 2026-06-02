import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DimeImportDialog, {
  DimeImportDialogProps,
  StructuredTransaction,
  ImportParseResult,
  DuplicateCheckResult,
} from './DimeImportDialog';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../store/api', () => ({
  apiUpload: vi.fn(),
}));

import { apiUpload } from '../../store/api';

const mockApiUpload = vi.mocked(apiUpload);

// ============================================================
// Helpers
// ============================================================

function makeTransaction(overrides: Partial<StructuredTransaction> = {}): StructuredTransaction {
  return {
    ticker: 'AAPL',
    date: '2024-01-15',
    price_per_share: 185.5,
    shares: 10,
    total_amount: 1855.0,
    ...overrides,
  };
}

function makeParseResult(overrides: Partial<ImportParseResult> = {}): ImportParseResult {
  return {
    transactions: [makeTransaction(), makeTransaction({ ticker: 'VOO', price_per_share: 450.25, shares: 5, total_amount: 2251.25 })],
    errors: [],
    totalRows: 2,
    successfulRows: 2,
    ...overrides,
  };
}

function makeDuplicateResult(overrides: Partial<DuplicateCheckResult> = {}): DuplicateCheckResult {
  return {
    duplicates: [
      {
        imported: makeTransaction({ ticker: 'AAPL' }),
        existing: {
          id: '123',
          tickerSymbol: 'AAPL',
          transactionDate: '2024-01-15',
          pricePerShare: 185.5,
          shares: 10,
          totalAmount: 1855.0,
        },
      },
    ],
    unique: [makeTransaction({ ticker: 'VOO', price_per_share: 450.25, shares: 5, total_amount: 2251.25 })],
    ...overrides,
  };
}

function renderDialog(props: Partial<DimeImportDialogProps> = {}) {
  const defaultProps: DimeImportDialogProps = {
    visible: true,
    onClose: vi.fn(),
    onImportComplete: vi.fn(),
    ...props,
  };
  return { ...render(<DimeImportDialog {...defaultProps} />), props: defaultProps };
}

function createFile(name: string, type: string, content = 'test'): File {
  return new File([content], name, { type });
}

// ============================================================
// Tests
// ============================================================

describe('DimeImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      renderDialog({ visible: false });
      expect(screen.queryByTestId('dime-import-dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when visible is true', () => {
      renderDialog({ visible: true });
      expect(screen.getByTestId('dime-import-dialog')).toBeInTheDocument();
    });

    it('has dialog role and aria-modal', () => {
      renderDialog();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Step 1: File Upload Area', () => {
    it('shows upload step initially', () => {
      renderDialog();
      expect(screen.getByTestId('upload-step')).toBeInTheDocument();
      expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    });

    it('shows instructions text', () => {
      renderDialog();
      expect(
        screen.getByText(/drag & drop your dime export file here/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/supports csv and json formats/i)).toBeInTheDocument();
    });

    it('shows upload button disabled when no file selected', () => {
      renderDialog();
      const uploadBtn = screen.getByTestId('upload-button');
      expect(uploadBtn).toBeDisabled();
    });

    it('accepts CSV file via input', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      const file = createFile('transactions.csv', 'text/csv');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('selected-file-name')).toHaveTextContent('transactions.csv');
      expect(screen.getByTestId('upload-button')).not.toBeDisabled();
    });

    it('accepts JSON file via input', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      const file = createFile('data.json', 'application/json');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('selected-file-name')).toHaveTextContent('data.json');
    });

    it('rejects invalid file types', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      const file = createFile('image.png', 'image/png');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('import-error')).toBeInTheDocument();
      expect(
        screen.getByText(/invalid file format/i)
      ).toBeInTheDocument();
      expect(screen.queryByTestId('selected-file-name')).not.toBeInTheDocument();
    });

    it('rejects file with unsupported extension (.txt)', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      const file = createFile('data.txt', 'text/plain');

      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.getByTestId('import-error')).toBeInTheDocument();
    });

    it('handles drag and drop', () => {
      renderDialog();
      const dropZone = screen.getByTestId('drop-zone');
      const file = createFile('data.csv', 'text/csv');

      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-500');

      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
      expect(screen.getByTestId('selected-file-name')).toHaveTextContent('data.csv');
    });

    it('highlights drop zone during drag over', () => {
      renderDialog();
      const dropZone = screen.getByTestId('drop-zone');

      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50');

      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveClass('border-blue-500');
    });
  });

  describe('File type validation', () => {
    it('accepts .csv extension', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('export.csv', 'text/csv')] } });
      expect(screen.queryByTestId('import-error')).not.toBeInTheDocument();
    });

    it('accepts .json extension', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('export.json', 'application/json')] } });
      expect(screen.queryByTestId('import-error')).not.toBeInTheDocument();
    });

    it('rejects .xlsx extension', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, {
        target: { files: [createFile('export.xlsx', 'application/vnd.openxmlformats')] },
      });
      expect(screen.getByTestId('import-error')).toBeInTheDocument();
    });

    it('rejects .pdf extension', () => {
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, {
        target: { files: [createFile('doc.pdf', 'application/pdf')] },
      });
      expect(screen.getByTestId('import-error')).toBeInTheDocument();
    });
  });

  describe('Step 2: Preview Table', () => {
    async function goToPreview() {
      mockApiUpload.mockResolvedValueOnce(makeParseResult());
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());
    }

    it('shows preview table after successful parse', async () => {
      await goToPreview();
      expect(screen.getByTestId('preview-table')).toBeInTheDocument();
    });

    it('displays parsed transactions in table rows', async () => {
      await goToPreview();
      expect(screen.getByTestId('preview-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('preview-row-1')).toBeInTheDocument();
    });

    it('shows transaction details in columns', async () => {
      await goToPreview();
      const row = screen.getByTestId('preview-row-0');
      expect(row).toHaveTextContent('AAPL');
      expect(row).toHaveTextContent('2024-01-15');
      expect(row).toHaveTextContent('$185.50');
      expect(row).toHaveTextContent('10');
      expect(row).toHaveTextContent('$1855.00');
    });

    it('shows summary with successful count', async () => {
      await goToPreview();
      expect(screen.getByText('2 parsed successfully')).toBeInTheDocument();
    });

    it('shows parse errors when present', async () => {
      mockApiUpload.mockResolvedValueOnce(
        makeParseResult({
          errors: [{ row: 3, message: 'Invalid date format' }],
          totalRows: 3,
          successfulRows: 2,
        })
      );
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('parse-errors')).toBeInTheDocument());
      expect(screen.getByText(/row 3: invalid date format/i)).toBeInTheDocument();
    });

    it('shows Continue button to proceed to duplicate check', async () => {
      await goToPreview();
      expect(screen.getByTestId('check-duplicates-button')).toBeInTheDocument();
      expect(screen.getByTestId('check-duplicates-button')).toHaveTextContent('Continue');
    });
  });

  describe('Step 3: Duplicate Handling', () => {
    async function goToDuplicates(duplicateOverrides: Partial<DuplicateCheckResult> = {}) {
      mockApiUpload
        .mockResolvedValueOnce(makeParseResult())
        .mockResolvedValueOnce(makeDuplicateResult(duplicateOverrides));

      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('check-duplicates-button'));
      await waitFor(() => expect(screen.getByTestId('duplicates-step')).toBeInTheDocument());
    }

    it('shows duplicates step with duplicate info', async () => {
      await goToDuplicates();
      expect(screen.getByText(/1 duplicate/)).toBeInTheDocument();
      expect(screen.getByText(/1 new/)).toBeInTheDocument();
    });

    it('shows duplicates table', async () => {
      await goToDuplicates();
      expect(screen.getByTestId('duplicates-table')).toBeInTheDocument();
      expect(screen.getByTestId('duplicate-row-0')).toBeInTheDocument();
    });

    it('shows skip/overwrite radio options', async () => {
      await goToDuplicates();
      expect(screen.getByTestId('action-skip')).toBeInTheDocument();
      expect(screen.getByTestId('action-overwrite')).toBeInTheDocument();
    });

    it('defaults to skip duplicates', async () => {
      await goToDuplicates();
      expect(screen.getByTestId('action-skip')).toBeChecked();
      expect(screen.getByTestId('action-overwrite')).not.toBeChecked();
    });

    it('allows selecting overwrite', async () => {
      await goToDuplicates();
      fireEvent.click(screen.getByTestId('action-overwrite'));
      expect(screen.getByTestId('action-overwrite')).toBeChecked();
    });

    it('shows no duplicates message when none found', async () => {
      await goToDuplicates({ duplicates: [], unique: [makeTransaction(), makeTransaction({ ticker: 'VOO' })] });
      expect(screen.getByTestId('no-duplicates-message')).toBeInTheDocument();
    });

    it('shows Import button', async () => {
      await goToDuplicates();
      expect(screen.getByTestId('import-button')).toBeInTheDocument();
      expect(screen.getByTestId('import-button')).toHaveTextContent('Import');
    });
  });

  describe('Import Confirmation', () => {
    it('calls onImportComplete and onClose on successful import', async () => {
      const onImportComplete = vi.fn();
      const onClose = vi.fn();
      const importResult = { imported: 2, skipped: 0, overwritten: 0 };

      mockApiUpload
        .mockResolvedValueOnce(makeParseResult())
        .mockResolvedValueOnce(makeDuplicateResult({ duplicates: [], unique: [makeTransaction()] }))
        .mockResolvedValueOnce(importResult);

      renderDialog({ onImportComplete, onClose });
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('check-duplicates-button'));
      await waitFor(() => expect(screen.getByTestId('duplicates-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('import-button'));
      await waitFor(() => expect(onImportComplete).toHaveBeenCalledWith(importResult));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('shows error for unsupported format from API', async () => {
      mockApiUpload.mockRejectedValueOnce({ code: 'UNSUPPORTED_FORMAT', message: 'Unsupported format' });
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));

      await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument());
      expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
    });

    it('shows generic error on API failure', async () => {
      mockApiUpload.mockRejectedValueOnce({ message: 'Network error' });
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));

      await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument());
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows error when file has no valid transactions', async () => {
      mockApiUpload.mockResolvedValueOnce(
        makeParseResult({
          transactions: [],
          errors: [{ row: 1, message: 'Invalid format' }],
          totalRows: 1,
          successfulRows: 0,
        })
      );
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('bad.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));

      await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument());
      expect(screen.getByText(/failed to parse the file/i)).toBeInTheDocument();
    });
  });

  describe('Cancel Behavior', () => {
    it('calls onClose when Cancel is clicked on upload step', () => {
      const onClose = vi.fn();
      renderDialog({ onClose });
      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked on preview step', async () => {
      const onClose = vi.fn();
      mockApiUpload.mockResolvedValueOnce(makeParseResult());
      renderDialog({ onClose });
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Cancel is clicked on duplicates step', async () => {
      const onClose = vi.fn();
      mockApiUpload
        .mockResolvedValueOnce(makeParseResult())
        .mockResolvedValueOnce(makeDuplicateResult());

      renderDialog({ onClose });
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('check-duplicates-button'));
      await waitFor(() => expect(screen.getByTestId('duplicates-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('cancel-button'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading States', () => {
    it('shows "Parsing..." during upload', async () => {
      mockApiUpload.mockReturnValueOnce(new Promise(() => {})); // Never resolves
      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));

      expect(screen.getByTestId('upload-button')).toHaveTextContent('Parsing...');
      expect(screen.getByTestId('upload-button')).toBeDisabled();
    });

    it('shows "Checking..." during duplicate check', async () => {
      mockApiUpload
        .mockResolvedValueOnce(makeParseResult())
        .mockReturnValueOnce(new Promise(() => {})); // Never resolves

      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('check-duplicates-button'));
      expect(screen.getByTestId('check-duplicates-button')).toHaveTextContent('Checking...');
    });

    it('shows "Importing..." during import', async () => {
      mockApiUpload
        .mockResolvedValueOnce(makeParseResult())
        .mockResolvedValueOnce(makeDuplicateResult({ duplicates: [], unique: [makeTransaction()] }))
        .mockReturnValueOnce(new Promise(() => {})); // Never resolves

      renderDialog();
      const input = screen.getByTestId('file-input');
      fireEvent.change(input, { target: { files: [createFile('data.csv', 'text/csv')] } });
      fireEvent.click(screen.getByTestId('upload-button'));
      await waitFor(() => expect(screen.getByTestId('preview-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('check-duplicates-button'));
      await waitFor(() => expect(screen.getByTestId('duplicates-step')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('import-button'));
      expect(screen.getByTestId('import-button')).toHaveTextContent('Importing...');
    });
  });

  describe('Modal overlay', () => {
    it('renders as a fixed position overlay with backdrop', () => {
      renderDialog();
      const dialog = screen.getByTestId('dime-import-dialog');
      expect(dialog).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('shows title "Import from Dime"', () => {
      renderDialog();
      expect(screen.getByText('Import from Dime')).toBeInTheDocument();
    });
  });
});
