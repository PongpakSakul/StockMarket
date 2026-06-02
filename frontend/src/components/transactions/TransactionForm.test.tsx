import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionForm, {
  type TransactionFormData,
  type TransactionFormProps,
} from './TransactionForm';

function renderForm(props: Partial<TransactionFormProps> = {}) {
  const defaultProps: TransactionFormProps = {
    mode: 'create',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  return {
    ...render(<TransactionForm {...defaultProps} />),
    onSubmit: defaultProps.onSubmit as ReturnType<typeof vi.fn>,
    onCancel: defaultProps.onCancel as ReturnType<typeof vi.fn>,
  };
}

describe('TransactionForm', () => {
  describe('rendering', () => {
    it('renders all form fields', () => {
      renderForm();

      expect(screen.getByLabelText('Ticker Symbol')).toBeInTheDocument();
      expect(screen.getByLabelText('Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Price Per Share (USD)')).toBeInTheDocument();
      expect(screen.getByLabelText('Shares')).toBeInTheDocument();
      expect(screen.getByLabelText('Total Amount (USD)')).toBeInTheDocument();
    });

    it('renders submit button with "Add Transaction" in create mode', () => {
      renderForm({ mode: 'create' });
      expect(screen.getByRole('button', { name: 'Add Transaction' })).toBeInTheDocument();
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
          transactionDate: '2024-01-15',
          pricePerShare: 420.5,
          shares: 2.5,
          totalAmount: 1051.25,
        },
      });

      expect(screen.getByLabelText('Ticker Symbol')).toHaveValue('VOO');
      expect(screen.getByLabelText('Date')).toHaveValue('2024-01-15');
      expect(screen.getByLabelText('Price Per Share (USD)')).toHaveValue(420.5);
      expect(screen.getByLabelText('Shares')).toHaveValue(2.5);
      expect(screen.getByLabelText('Total Amount (USD)')).toHaveValue(1051.25);
    });
  });

  describe('validation', () => {
    it('shows error when ticker symbol is empty', async () => {
      renderForm();

      const tickerInput = screen.getByLabelText('Ticker Symbol');
      fireEvent.change(tickerInput, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Ticker symbol is required')).toBeInTheDocument();
      });
    });

    it('shows error when date is in the future', async () => {
      renderForm();

      const dateInput = screen.getByLabelText('Date');
      fireEvent.change(dateInput, { target: { value: '2099-12-31' } });
      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'VOO' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '1' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Date cannot be in the future')).toBeInTheDocument();
      });
    });

    it('shows error when price per share is zero', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'VOO' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '0' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '1' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Price per share must be positive')).toBeInTheDocument();
      });
    });

    it('shows error when price per share is negative', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'VOO' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '-10' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '1' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Price per share must be positive')).toBeInTheDocument();
      });
    });

    it('shows error when shares is zero', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'VOO' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '0' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Shares must be positive')).toBeInTheDocument();
      });
    });

    it('shows error when total amount is zero', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'VOO' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '1' },
      });
      // Override auto-calculated total with 0
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), {
        target: { value: '0' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByText('Total amount must be positive')).toBeInTheDocument();
      });
    });

    it('does not show errors before form submission or blur', () => {
      renderForm();
      expect(screen.queryByText('Ticker symbol is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Date cannot be in the future')).not.toBeInTheDocument();
    });

    it('shows error on blur for empty ticker', () => {
      renderForm();

      const tickerInput = screen.getByLabelText('Ticker Symbol');
      fireEvent.change(tickerInput, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      expect(screen.getByText('Ticker symbol is required')).toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data when valid', async () => {
      const { onSubmit } = renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'voo' },
      });
      fireEvent.change(screen.getByLabelText('Date'), {
        target: { value: '2024-01-15' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '420.50' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '2.5' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          tickerSymbol: 'VOO',
          transactionDate: '2024-01-15',
          pricePerShare: 420.5,
          shares: 2.5,
          totalAmount: 1051.25,
        } satisfies TransactionFormData);
      });
    });

    it('uppercases ticker symbol on submit', async () => {
      const { onSubmit } = renderForm();

      fireEvent.change(screen.getByLabelText('Ticker Symbol'), {
        target: { value: 'qqqm' },
      });
      fireEvent.change(screen.getByLabelText('Date'), {
        target: { value: '2024-01-15' },
      });
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '170' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '1' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ tickerSymbol: 'QQQM' })
        );
      });
    });

    it('does not call onSubmit when form is invalid', async () => {
      const { onSubmit } = renderForm();

      // Submit with empty form
      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

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

  describe('auto-calculate total amount', () => {
    it('auto-calculates total when price and shares are entered', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '3' },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Total Amount (USD)')).toHaveValue(300);
      });
    });

    it('shows auto-calculate hint when total is calculated', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '2' },
      });

      await waitFor(() => {
        expect(screen.getByText('Auto-calculated from price × shares')).toBeInTheDocument();
      });
    });

    it('stops auto-calculating when user manually edits total', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '2' },
      });

      // Manually override total
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), {
        target: { value: '250' },
      });

      expect(screen.getByLabelText('Total Amount (USD)')).toHaveValue(250);
    });

    it('resumes auto-calculating when price changes after manual override', async () => {
      renderForm();

      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '100' },
      });
      fireEvent.change(screen.getByLabelText('Shares'), {
        target: { value: '2' },
      });

      // Manually override total
      fireEvent.change(screen.getByLabelText('Total Amount (USD)'), {
        target: { value: '250' },
      });

      // Change price — should resume auto-calc
      fireEvent.change(screen.getByLabelText('Price Per Share (USD)'), {
        target: { value: '150' },
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Total Amount (USD)')).toHaveValue(300);
      });
    });
  });

  describe('accessibility', () => {
    it('has accessible form label', () => {
      renderForm();
      expect(screen.getByRole('form', { name: 'Transaction form' })).toBeInTheDocument();
    });

    it('marks invalid fields with aria-invalid', async () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        expect(screen.getByLabelText('Ticker Symbol')).toHaveAttribute(
          'aria-invalid',
          'true'
        );
      });
    });

    it('associates error messages with fields via aria-describedby', async () => {
      renderForm();

      fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));

      await waitFor(() => {
        const tickerInput = screen.getByLabelText('Ticker Symbol');
        expect(tickerInput).toHaveAttribute('aria-describedby', 'tickerSymbol-error');
        expect(screen.getByText('Ticker symbol is required')).toHaveAttribute(
          'id',
          'tickerSymbol-error'
        );
      });
    });
  });
});
