import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DividendForm, {
  type DividendFormData,
  type DividendFormProps,
  validateDividendForm,
} from './DividendForm';

function renderForm(props: Partial<DividendFormProps> = {}) {
  const defaultProps: DividendFormProps = {
    mode: 'create',
    holdings: ['VOO', 'QQQM', 'AAPL'],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  return {
    ...render(<DividendForm {...defaultProps} />),
    onSubmit: defaultProps.onSubmit as ReturnType<typeof vi.fn>,
    onCancel: defaultProps.onCancel as ReturnType<typeof vi.fn>,
  };
}

describe('DividendForm', () => {
  describe('rendering', () => {
    it('renders all form fields', () => {
      renderForm();

      expect(screen.getByLabelText('Ticker Symbol')).toBeInTheDocument();
      expect(screen.getByLabelText('Dividend Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Amount Per Share (USD)')).toBeInTheDocument();
      expect(screen.getByLabelText('Total Amount (USD)')).toBeInTheDocument();
    });

    it('renders submit button with "Add Dividend" in create mode', () => {
      renderForm({ mode: 'create' });
      expect(screen.getByRole('button', { name: 'Add Dividend' })).toBeInTheDocument();
    });

    it('renders submit button with "Save Changes" in edit mode', () => {
      renderForm({ mode: 'edit' });
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders "Saving..." when loading', () => {
      renderForm({ loading: true });
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
    });

    it('disables submit button when loading', () => {
      renderForm({ loading: true });
      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    });
  });

  describe('initial values (edit mode)', () => {
    it('populates fields with initial values', () => {
      renderForm({
        mode: 'edit',
        initialValues: {
          tickerSymbol: 'VOO',
          dividendDate: '2024-03-15',
          amountPerShare: 1.5432,
          totalAmount: 7.72,
        },
      });

      expect(screen.getByLabelText('Ticker Symbol')).toHaveValue('VOO');
      expect(screen.getByLabelText('Dividend Date')).toHaveValue('2024-03-15');
      // Number inputs store as strings internally but toHaveValue matches the input value
      expect(screen.getByLabelText('Amount Per Share (USD)')).toHaveDisplayValue('1.5432');
      expect(screen.getByLabelText('Total Amount (USD)')).toHaveDisplayValue('7.72');
    });
  });

  describe('validation', () => {
    it('shows error when ticker symbol is empty', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Ticker symbol is required')).toBeInTheDocument();
      });
    });

    it('shows error when ticker is not in holdings', async () => {
      renderForm({ holdings: ['VOO', 'QQQM'] });

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'TSLA' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Ticker must be a stock you currently hold')).toBeInTheDocument();
      });
    });

    it('shows error when date is in the future', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'VOO' } });
      fireEvent.change(screen.getByLabelText('Dividend Date'), { target: { value: '2099-12-31' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Date cannot be in the future')).toBeInTheDocument();
      });
    });

    it('shows error when amount per share is zero', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'VOO' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '0' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Amount per share must be positive')).toBeInTheDocument();
      });
    });

    it('shows error when total amount is zero', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'VOO' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '1' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '0' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Total amount must be positive')).toBeInTheDocument();
      });
    });

    it('does not show errors before form submission', () => {
      renderForm();
      expect(screen.queryByText('Ticker symbol is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Amount per share must be positive')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data when valid', async () => {
      const { onSubmit } = renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'voo' } });
      fireEvent.change(screen.getByLabelText('Dividend Date'), { target: { value: '2024-03-15' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '1.5432' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '7.72' } });

      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          tickerSymbol: 'VOO',
          dividendDate: '2024-03-15',
          amountPerShare: 1.5432,
          totalAmount: 7.72,
        } satisfies DividendFormData);
      });
    });

    it('uppercases ticker symbol on submit', async () => {
      const { onSubmit } = renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), { target: { value: 'qqqm' } });
      fireEvent.change(screen.getByLabelText('Dividend Date'), { target: { value: '2024-03-15' } });
      fireEvent.change(screen.getByLabelText('Amount Per Share (USD)'), { target: { value: '0.5' } });
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), { target: { value: '5' } });

      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ tickerSymbol: 'QQQM' })
        );
      });
    });

    it('does not call onSubmit when form is invalid', async () => {
      const { onSubmit } = renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByText('Ticker symbol is required')).toBeInTheDocument();
      });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('cancel button', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const { onCancel } = renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has accessible form label', () => {
      renderForm();
      expect(screen.getByRole('form', { name: 'Dividend form' })).toBeInTheDocument();
    });

    it('marks invalid fields with aria-invalid', async () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Ticker Symbol')).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('associates error messages with fields via aria-describedby', async () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Add Dividend' }));

      await waitFor(() => {
        const tickerInput = screen.getByLabelText('Ticker Symbol');
        expect(tickerInput).toHaveAttribute('aria-describedby', 'dividend-tickerSymbol-error');
        expect(screen.getByText('Ticker symbol is required')).toHaveAttribute(
          'id',
          'dividend-tickerSymbol-error'
        );
      });
    });
  });

  describe('validateDividendForm', () => {
    it('returns empty errors object for valid data', () => {
      const errors = validateDividendForm(
        { tickerSymbol: 'VOO', dividendDate: '2024-03-15', amountPerShare: 1.5, totalAmount: 7.5 },
        ['VOO', 'QQQM']
      );
      expect(errors).toEqual({});
    });

    it('returns error for empty ticker', () => {
      const errors = validateDividendForm(
        { tickerSymbol: '', dividendDate: '2024-03-15', amountPerShare: 1.5, totalAmount: 7.5 },
        ['VOO']
      );
      expect(errors.tickerSymbol).toBe('Ticker symbol is required');
    });

    it('returns error for ticker not in holdings', () => {
      const errors = validateDividendForm(
        { tickerSymbol: 'TSLA', dividendDate: '2024-03-15', amountPerShare: 1.5, totalAmount: 7.5 },
        ['VOO', 'QQQM']
      );
      expect(errors.tickerSymbol).toBe('Ticker must be a stock you currently hold');
    });

    it('returns error for negative amount per share', () => {
      const errors = validateDividendForm(
        { tickerSymbol: 'VOO', dividendDate: '2024-03-15', amountPerShare: -1, totalAmount: 7.5 },
        ['VOO']
      );
      expect(errors.amountPerShare).toBe('Amount per share must be positive');
    });

    it('returns error for negative total amount', () => {
      const errors = validateDividendForm(
        { tickerSymbol: 'VOO', dividendDate: '2024-03-15', amountPerShare: 1.5, totalAmount: -5 },
        ['VOO']
      );
      expect(errors.totalAmount).toBe('Total amount must be positive');
    });
  });
});
