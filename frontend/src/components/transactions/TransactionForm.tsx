'use client';

import { useState, useCallback } from 'react';

export interface TransactionFormData {
  tickerSymbol: string;
  transactionDate: string;
  pricePerShare: number;
  shares: number;
  totalAmount: number;
}

export interface TransactionFormErrors {
  tickerSymbol?: string;
  transactionDate?: string;
  pricePerShare?: string;
  shares?: string;
  totalAmount?: string;
}

export interface TransactionFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<TransactionFormData>;
  onSubmit: (data: TransactionFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

export function validateForm(data: TransactionFormData): TransactionFormErrors {
  const errors: TransactionFormErrors = {};

  if (!data.tickerSymbol || data.tickerSymbol.trim() === '') {
    errors.tickerSymbol = 'Ticker symbol is required';
  }

  if (!data.transactionDate) {
    errors.transactionDate = 'Date is required';
  } else {
    const selectedDate = new Date(data.transactionDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      errors.transactionDate = 'Date cannot be in the future';
    }
  }

  if (data.pricePerShare <= 0) {
    errors.pricePerShare = 'Price per share must be positive';
  }

  if (data.shares <= 0) {
    errors.shares = 'Shares must be positive';
  }

  if (data.totalAmount <= 0) {
    errors.totalAmount = 'Total amount must be positive';
  }

  return errors;
}

function computeTotal(priceStr: string, sharesStr: string): string {
  const price = parseFloat(priceStr);
  const qty = parseFloat(sharesStr);
  if (!isNaN(price) && !isNaN(qty) && price > 0 && qty > 0) {
    return String(Math.round(price * qty * 100) / 100);
  }
  return '';
}

export default function TransactionForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
}: TransactionFormProps) {
  const [tickerSymbol, setTickerSymbol] = useState(initialValues?.tickerSymbol ?? '');
  const [transactionDate, setTransactionDate] = useState(
    initialValues?.transactionDate ?? getTodayString()
  );
  const [pricePerShare, setPricePerShare] = useState<string>(
    initialValues?.pricePerShare != null ? String(initialValues.pricePerShare) : ''
  );
  const [shares, setShares] = useState<string>(
    initialValues?.shares != null ? String(initialValues.shares) : ''
  );
  const [totalAmount, setTotalAmount] = useState<string>(
    initialValues?.totalAmount != null ? String(initialValues.totalAmount) : ''
  );
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleTotalAmountChange = useCallback((value: string) => {
    setAutoCalculate(false);
    setTotalAmount(value);
  }, []);

  const handlePriceChange = useCallback(
    (value: string) => {
      setPricePerShare(value);
      setAutoCalculate(true);
      const computed = computeTotal(value, shares);
      if (computed) {
        setTotalAmount(computed);
      }
    },
    [shares]
  );

  const handleSharesChange = useCallback(
    (value: string) => {
      setShares(value);
      setAutoCalculate(true);
      const computed = computeTotal(pricePerShare, value);
      if (computed) {
        setTotalAmount(computed);
      }
    },
    [pricePerShare]
  );

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData: TransactionFormData = {
      tickerSymbol: tickerSymbol.trim().toUpperCase(),
      transactionDate,
      pricePerShare: parseFloat(pricePerShare) || 0,
      shares: parseFloat(shares) || 0,
      totalAmount: parseFloat(totalAmount) || 0,
    };

    const validationErrors = validateForm(formData);
    setErrors(validationErrors);
    setTouched({
      tickerSymbol: true,
      transactionDate: true,
      pricePerShare: true,
      shares: true,
      totalAmount: true,
    });

    if (Object.keys(validationErrors).length === 0) {
      onSubmit(formData);
    }
  };

  const isAutoCalculated = autoCalculate && parseFloat(pricePerShare) > 0 && parseFloat(shares) > 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Transaction form">
      {/* Ticker Symbol */}
      <div>
        <label htmlFor="tickerSymbol" className="block text-sm font-medium text-gray-700">
          Ticker Symbol
        </label>
        <input
          id="tickerSymbol"
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
          aria-describedby={touched.tickerSymbol && errors.tickerSymbol ? 'tickerSymbol-error' : undefined}
        />
        {touched.tickerSymbol && errors.tickerSymbol && (
          <p id="tickerSymbol-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.tickerSymbol}
          </p>
        )}
      </div>

      {/* Transaction Date */}
      <div>
        <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700">
          Date
        </label>
        <input
          id="transactionDate"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          onBlur={() => markTouched('transactionDate')}
          max={getTodayString()}
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.transactionDate && errors.transactionDate
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.transactionDate && !!errors.transactionDate}
          aria-describedby={touched.transactionDate && errors.transactionDate ? 'transactionDate-error' : undefined}
        />
        {touched.transactionDate && errors.transactionDate && (
          <p id="transactionDate-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.transactionDate}
          </p>
        )}
      </div>

      {/* Price Per Share */}
      <div>
        <label htmlFor="pricePerShare" className="block text-sm font-medium text-gray-700">
          Price Per Share (USD)
        </label>
        <input
          id="pricePerShare"
          type="number"
          step="0.01"
          min="0.01"
          value={pricePerShare}
          onChange={(e) => handlePriceChange(e.target.value)}
          onBlur={() => markTouched('pricePerShare')}
          placeholder="0.00"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.pricePerShare && errors.pricePerShare
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.pricePerShare && !!errors.pricePerShare}
          aria-describedby={touched.pricePerShare && errors.pricePerShare ? 'pricePerShare-error' : undefined}
        />
        {touched.pricePerShare && errors.pricePerShare && (
          <p id="pricePerShare-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.pricePerShare}
          </p>
        )}
      </div>

      {/* Shares */}
      <div>
        <label htmlFor="shares" className="block text-sm font-medium text-gray-700">
          Shares
        </label>
        <input
          id="shares"
          type="number"
          step="0.000001"
          min="0.000001"
          value={shares}
          onChange={(e) => handleSharesChange(e.target.value)}
          onBlur={() => markTouched('shares')}
          placeholder="0.000000"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.shares && errors.shares ? 'border-red-500' : 'border-gray-300'
          }`}
          aria-invalid={touched.shares && !!errors.shares}
          aria-describedby={touched.shares && errors.shares ? 'shares-error' : undefined}
        />
        {touched.shares && errors.shares && (
          <p id="shares-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.shares}
          </p>
        )}
      </div>

      {/* Total Amount */}
      <div>
        <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">
          Total Amount (USD)
        </label>
        <input
          id="totalAmount"
          type="number"
          step="0.01"
          min="0.01"
          value={totalAmount}
          onChange={(e) => handleTotalAmountChange(e.target.value)}
          onBlur={() => markTouched('totalAmount')}
          placeholder="0.00"
          className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            touched.totalAmount && errors.totalAmount
              ? 'border-red-500'
              : 'border-gray-300'
          }`}
          aria-invalid={touched.totalAmount && !!errors.totalAmount}
          aria-describedby={touched.totalAmount && errors.totalAmount ? 'totalAmount-error' : undefined}
        />
        {touched.totalAmount && errors.totalAmount && (
          <p id="totalAmount-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.totalAmount}
          </p>
        )}
        {isAutoCalculated && (
          <p className="mt-1 text-xs text-gray-500">Auto-calculated from price × shares</p>
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
          {loading ? 'Saving...' : mode === 'create' ? 'Add Transaction' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
