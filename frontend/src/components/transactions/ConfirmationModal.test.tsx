import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmationModal, {
  ParsedSlipResult,
  ConfirmationModalProps,
} from './ConfirmationModal';

// ============================================================
// Helpers
// ============================================================

function makeResult(overrides: Partial<ParsedSlipResult> = {}): ParsedSlipResult {
  return {
    ticker: 'AAPL',
    date: '2024-01-15',
    pricePerShare: 185.5,
    shares: 10,
    totalAmount: 1855.0,
    missingFields: [],
    success: true,
    ...overrides,
  };
}

function renderModal(props: Partial<ConfirmationModalProps> = {}) {
  const defaultProps: ConfirmationModalProps = {
    results: [makeResult()],
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onManualEntry: vi.fn(),
    visible: true,
    ...props,
  };
  return { ...render(<ConfirmationModal {...defaultProps} />), props: defaultProps };
}

// ============================================================
// Tests
// ============================================================

describe('ConfirmationModal', () => {
  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      renderModal({ visible: false });
      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });

    it('renders modal when visible is true', () => {
      renderModal({ visible: true });
      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });
  });

  describe('single result display', () => {
    it('displays parsed transaction data in editable fields', () => {
      renderModal({
        results: [makeResult({ ticker: 'VOO', date: '2024-03-10', pricePerShare: 450.25, shares: 5, totalAmount: 2251.25 })],
      });

      expect(screen.getByTestId('field-0-ticker')).toHaveValue('VOO');
      expect(screen.getByTestId('field-0-date')).toHaveValue('2024-03-10');
      expect(screen.getByTestId('field-0-pricePerShare')).toHaveValue(450.25);
      expect(screen.getByTestId('field-0-shares')).toHaveValue(5);
      expect(screen.getByTestId('field-0-totalAmount')).toHaveValue(2251.25);
    });

    it('allows editing fields before confirming', () => {
      const onConfirm = vi.fn();
      renderModal({
        results: [makeResult({ ticker: 'AAPL' })],
        onConfirm,
      });

      const tickerInput = screen.getByTestId('field-0-ticker');
      fireEvent.change(tickerInput, { target: { value: 'MSFT' } });

      fireEvent.click(screen.getByTestId('confirm-button'));
      expect(onConfirm).toHaveBeenCalledWith([
        expect.objectContaining({ ticker: 'MSFT' }),
      ]);
    });

    it('shows "Confirm Transaction" title for single result', () => {
      renderModal({ results: [makeResult()] });
      expect(screen.getByText('Confirm Transaction')).toBeInTheDocument();
    });
  });

  describe('missing fields highlighting', () => {
    it('highlights missing fields with visual indicator', () => {
      renderModal({
        results: [makeResult({ ticker: undefined, missingFields: ['ticker'], success: true })],
      });

      expect(screen.getByTestId('missing-indicator-0-ticker')).toBeInTheDocument();
      expect(screen.getByTestId('missing-indicator-0-ticker')).toHaveTextContent('(required)');
    });

    it('applies amber styling to missing field inputs', () => {
      renderModal({
        results: [makeResult({ shares: undefined, missingFields: ['shares'], success: true })],
      });

      const input = screen.getByTestId('field-0-shares');
      expect(input).toHaveClass('border-amber-400');
    });

    it('removes missing indicator when user fills the field', () => {
      renderModal({
        results: [makeResult({ ticker: undefined, missingFields: ['ticker'], success: true })],
      });

      const tickerInput = screen.getByTestId('field-0-ticker');
      fireEvent.change(tickerInput, { target: { value: 'TSLA' } });

      expect(screen.queryByTestId('missing-indicator-0-ticker')).not.toBeInTheDocument();
    });
  });

  describe('batch results', () => {
    const batchResults: ParsedSlipResult[] = [
      makeResult({ ticker: 'AAPL', success: true }),
      makeResult({ ticker: 'MSFT', success: true }),
      makeResult({ ticker: undefined, success: false, missingFields: ['ticker', 'date'] }),
    ];

    it('shows batch summary with success/failed counts', () => {
      renderModal({ results: batchResults });
      expect(screen.getByTestId('batch-summary')).toBeInTheDocument();
      expect(screen.getByText('2 successful')).toBeInTheDocument();
      expect(screen.getByText('1 failed')).toBeInTheDocument();
    });

    it('shows "Batch Upload Results" title for multiple results', () => {
      renderModal({ results: batchResults });
      expect(screen.getByText('Batch Upload Results')).toBeInTheDocument();
    });

    it('shows checkboxes for selective confirmation', () => {
      renderModal({ results: batchResults });
      expect(screen.getByTestId('checkbox-0')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-1')).toBeInTheDocument();
      expect(screen.getByTestId('checkbox-2')).toBeInTheDocument();
    });

    it('pre-selects successful results', () => {
      renderModal({ results: batchResults });
      expect(screen.getByTestId('checkbox-0')).toBeChecked();
      expect(screen.getByTestId('checkbox-1')).toBeChecked();
      expect(screen.getByTestId('checkbox-2')).not.toBeChecked();
    });

    it('allows toggling selection', () => {
      renderModal({ results: batchResults });
      const checkbox0 = screen.getByTestId('checkbox-0');

      fireEvent.click(checkbox0);
      expect(checkbox0).not.toBeChecked();

      fireEvent.click(checkbox0);
      expect(checkbox0).toBeChecked();
    });

    it('confirms only selected results', () => {
      const onConfirm = vi.fn();
      renderModal({ results: batchResults, onConfirm });

      // Deselect second item
      fireEvent.click(screen.getByTestId('checkbox-1'));

      fireEvent.click(screen.getByTestId('confirm-button'));
      expect(onConfirm).toHaveBeenCalledWith([
        expect.objectContaining({ ticker: 'AAPL' }),
      ]);
    });

    it('shows confirm button with count', () => {
      renderModal({ results: batchResults });
      expect(screen.getByTestId('confirm-button')).toHaveTextContent('Confirm (2)');
    });

    it('disables confirm button when nothing is selected', () => {
      renderModal({ results: batchResults });

      // Deselect all successful
      fireEvent.click(screen.getByTestId('checkbox-0'));
      fireEvent.click(screen.getByTestId('checkbox-1'));

      expect(screen.getByTestId('confirm-button')).toBeDisabled();
    });

    it('supports select all / deselect all', () => {
      renderModal({ results: batchResults });

      fireEvent.click(screen.getByText('Deselect all'));
      expect(screen.getByTestId('checkbox-0')).not.toBeChecked();
      expect(screen.getByTestId('checkbox-1')).not.toBeChecked();

      fireEvent.click(screen.getByText('Select all'));
      expect(screen.getByTestId('checkbox-0')).toBeChecked();
      expect(screen.getByTestId('checkbox-1')).toBeChecked();
      expect(screen.getByTestId('checkbox-2')).toBeChecked();
    });
  });

  describe('OCR complete failure', () => {
    it('shows failure message when all results failed', () => {
      renderModal({
        results: [
          makeResult({ success: false, missingFields: ['ticker', 'date', 'pricePerShare', 'shares', 'totalAmount'] }),
        ],
      });

      expect(screen.getByTestId('ocr-failed-message')).toBeInTheDocument();
      expect(screen.getByText('OCR Failed')).toBeInTheDocument();
    });

    it('offers manual entry fallback button', () => {
      const onManualEntry = vi.fn();
      renderModal({
        results: [makeResult({ success: false, missingFields: ['ticker'] })],
        onManualEntry,
      });

      const manualBtn = screen.getByTestId('manual-entry-button');
      expect(manualBtn).toBeInTheDocument();

      fireEvent.click(manualBtn);
      expect(onManualEntry).toHaveBeenCalledTimes(1);
    });

    it('shows cancel button in failure state', () => {
      const onCancel = vi.fn();
      renderModal({
        results: [makeResult({ success: false, missingFields: ['ticker'] })],
        onCancel,
      });

      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('calls onCancel when Cancel button is clicked', () => {
      const onCancel = vi.fn();
      renderModal({ onCancel });

      fireEvent.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm with edited data when Confirm is clicked', () => {
      const onConfirm = vi.fn();
      renderModal({
        results: [makeResult({ ticker: 'AAPL', pricePerShare: 100 })],
        onConfirm,
      });

      // Edit price
      fireEvent.change(screen.getByTestId('field-0-pricePerShare'), {
        target: { value: '200' },
      });

      fireEvent.click(screen.getByTestId('confirm-button'));
      expect(onConfirm).toHaveBeenCalledWith([
        expect.objectContaining({ pricePerShare: 200 }),
      ]);
    });
  });

  describe('modal overlay', () => {
    it('renders as a fixed position overlay with backdrop', () => {
      renderModal();
      const modal = screen.getByTestId('confirmation-modal');
      expect(modal).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('has dialog role and aria-modal', () => {
      renderModal();
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });
  });
});
