'use client';

import { useState, useCallback } from 'react';

export interface DividendFormData {
  tickerSymbol: string;
  dividendDate: string;
  amountPerShare: number;
  totalAmount: number;
}

export interface DividendFormErrors {
  tickerSymbol?: string;
  dividendDate?: string;
  amountPerShare?: string;
  totalAmount?: string;
}

export interface DividendFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<DividendFormData>;
  holdings: string[];
  onSubmit: (data: DividendFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function validateDividendForm(
  data: DividendFormData,
  holdings: string[]
): DividendFormErrors {
  const errors: DividendFormErrors = {};

  if (!data.tickerSymbol || data.tickerSymbol.trim() === '') {
    errors.tickerSymbol = 'Ticker symbol is required';
  } else if (!holdings.includes(data.tickerSymbol.trim().toUpperCase())) {
    errors.tickerSymbol = 'Ticker must be a stock you currently hold';
  }

  if (!data.dividendDate) {
    errors.dividendDate = 'Date is required';
  } else {
    const selectedDate = new Date(data.dividendDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      errors.dividendDate = 'Date cannot be in the future';
    }
  }

  if (data.amountPerShare <= 0) {
    errors.amountPerShare = 'Amount per share must be positive';
  }

  if (data.totalAmount <= 0) {
    errors.totalAmount = 'Total amount must be positive';
  }

  return errors;
}

export default function DividendForm({
  mode,
  initialValues,
  holdings,
  onSubmit,
  onCancel,
  loading = false,
}: DividendFormProps) {
  const [tickerSymbol, setTickerSymbol] = useState(initialValues?.tickerSymbol ?? '');
  const [dividendDate, setDividendDate] = useState(
    initialValues?.dividendDate ?? getTodayString()
  );
  const [amountPerShare, setAmountPerShare] = useState<string>(
    initialValues?.amountPerShare != null ? String(initialValues.amountPerShare) : ''
  );
  const [totalAmount, setTotalAmount] = useState<string>(
    initialValues?.totalAmount != null ? String(initialValues.totalAmount) : ''
  );
  const [errors, setErrors] = useState<DividendFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData: DividendFormData = {
      tickerSymbol: tickerSymbol.trim().toUpperCase(),
      dividendDate,
      amountPerShare: parseFloat(amountPerShare) || 0,
      totalAmount: parseFloat(totalAmount) || 0,
    };

    const validationErrors = validateDividendForm(formData, holdings);
    setErrors(validationErrors);
    setTouched({
      tickerSymbol: true,
      dividendDate: true,
      amountPerShare: true,
      totalAmount: true,
    });

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Dividend form">
      {/* Ticker Symbol */}
      <div>
        <label htmlFor="dividend-tickerSymbol" className="block text-sm font-medium text-gray-700">
          Ticker Symbol
        </label>
        <input
          id="dividend-tickerSymbol"
          type="text"
          value={tickerSymbol}
          onChange={(e) => setTickerSymbol(e.target.value)}
          onBlur={() => markTouched('tickerSymbol')}
          placeholder="e.g. VOO, QQQM"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.tickerSymbol && errors.tickerSymbol
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.tickerSymbol && !!errors.tickerSymbol}
          aria-describedby={
            touched.tickerSymbol && errors.tickerSymbol ? 'dividend-tickerSymbol-error' : undefined
          }
        />
        {touched.tickerSymbol && errors.tickerSymbol && (
          <p id="dividend-tickerSymbol-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.tickerSymbol}
          </p>
        )}
      </div>

      {/* Dividend Date */}
      <div>
        <label htmlFor="dividend-date" className="block text-sm font-medium text-gray-700">
          Dividend Date
        </label>
        <input
          id="dividend-date"
          type="date"
          value={dividendDate}
          onChange={(e) => setDividendDate(e.target.value)}
          onBlur={() => markTouched('dividendDate')}
          max={getTodayString()}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.dividendDate && errors.dividendDate
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.dividendDate && !!errors.dividendDate}
          aria-describedby={
            touched.dividendDate && errors.dividendDate ? 'dividend-date-error' : undefined
          }
        />
        {touched.dividendDate && errors.dividendDate && (
          <p id="dividend-date-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.dividendDate}
          </p>
        )}
      </div>

      {/* Amount Per Share */}
      <div>
        <label htmlFor="dividend-amountPerShare" className="block text-sm font-medium text-gray-700">
          Amount Per Share (USD)
        </label>
        <input
          id="dividend-amountPerShare"
          type="number"
          step="0.000001"
          min="0.000001"
          value={amountPerShare}
          onChange={(e) => setAmountPerShare(e.target.value)}
          onBlur={() => markTouched('amountPerShare')}
          placeholder="0.000000"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.amountPerShare && errors.amountPerShare
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.amountPerShare && !!errors.amountPerShare}
          aria-describedby={
            touched.amountPerShare && errors.amountPerShare ? 'dividend-amountPerShare-error' : undefined
          }
        />
        {touched.amountPerShare && errors.amountPerShare && (
          <p id="dividend-amountPerShare-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.amountPerShare}
          </p>
        )}
      </div>

      {/* Total Amount */}
      <div>
        <label htmlFor="dividend-totalAmount" className="block text-sm font-medium text-gray-700">
          Total Amount (USD)
        </label>
        <input
          id="dividend-totalAmount"
          type="number"
          step="0.01"
          min="0.01"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          onBlur={() => markTouched('totalAmount')}
          placeholder="0.00"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.totalAmount && errors.totalAmount
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.totalAmount && !!errors.totalAmount}
          aria-describedby={
            touched.totalAmount && errors.totalAmount ? 'dividend-totalAmount-error' : undefined
          }
        />
        {touched.totalAmount && errors.totalAmount && (
          <p id="dividend-totalAmount-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.totalAmount}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : mode === 'create' ? 'Add Dividend' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
