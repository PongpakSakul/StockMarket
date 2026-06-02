'use client';

import { useState, useCallback } from 'react';
import { apiDownload } from '../../store/api';

// ============================================================
// Types
// ============================================================

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportFilters {
  format: ExportFormat;
  tickerSymbol?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ExportDialogProps {
  visible: boolean;
  onClose: () => void;
}

// ============================================================
// Component
// ============================================================

export default function ExportDialog({ visible, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [tickerSymbol, setTickerSymbol] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyResult, setEmptyResult] = useState(false);

  const resetState = useCallback(() => {
    setFormat('csv');
    setTickerSymbol('');
    setFromDate('');
    setToDate('');
    setLoading(false);
    setError(null);
    setEmptyResult(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEmptyResult(false);

    try {
      const params: Record<string, string | number | undefined> = {
        format,
        ticker: tickerSymbol.trim().toUpperCase() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };

      const blob = await apiDownload('/export/transactions', params);

      // Check for empty results (backend may return empty file or small size)
      if (blob.size === 0) {
        setEmptyResult(true);
        setLoading(false);
        return;
      }

      // Check if response is a JSON error (e.g., empty results notification from backend)
      if (blob.type === 'application/json') {
        const text = await blob.text();
        try {
          const json = JSON.parse(text);
          if (json.code === 'NO_DATA' || json.message) {
            setEmptyResult(true);
            setLoading(false);
            return;
          }
        } catch {
          // Not JSON, proceed with download
        }
      }

      // Trigger file download
      const extension = format === 'csv' ? 'csv' : 'xlsx';
      const filename = `transactions_export.${extension}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleClose();
    } catch (err: unknown) {
      const apiError = err as { code?: string; message?: string };
      if (apiError.code === 'NO_DATA') {
        setEmptyResult(true);
      } else {
        setError(apiError.message || 'Failed to export data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [format, tickerSymbol, fromDate, toDate, handleClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Export Transactions"
      data-testid="export-dialog"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Export Transactions</h2>

        {/* Format Selection */}
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-gray-700">Export Format</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                className="h-4 w-4 text-blue-600 border-gray-300"
                data-testid="format-csv"
              />
              <span className="text-sm text-gray-700">CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportFormat"
                value="xlsx"
                checked={format === 'xlsx'}
                onChange={() => setFormat('xlsx')}
                className="h-4 w-4 text-blue-600 border-gray-300"
                data-testid="format-xlsx"
              />
              <span className="text-sm text-gray-700">Excel (.xlsx)</span>
            </label>
          </div>
        </fieldset>

        {/* Optional Filters */}
        <div className="mb-4 space-y-3">
          <div>
            <label htmlFor="export-ticker" className="block text-sm font-medium text-gray-700">
              Ticker Symbol (optional)
            </label>
            <input
              id="export-ticker"
              type="text"
              value={tickerSymbol}
              onChange={(e) => setTickerSymbol(e.target.value)}
              placeholder="e.g., VOO"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              data-testid="filter-ticker"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="export-from-date" className="block text-sm font-medium text-gray-700">
                From Date
              </label>
              <input
                id="export-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="filter-from-date"
              />
            </div>
            <div>
              <label htmlFor="export-to-date" className="block text-sm font-medium text-gray-700">
                To Date
              </label>
              <input
                id="export-to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="filter-to-date"
              />
            </div>
          </div>
        </div>

        {/* Empty Result Notification */}
        {emptyResult && (
          <div
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3"
            role="alert"
            data-testid="empty-result-alert"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-sm text-amber-800">
                No transactions found matching the selected filters.
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3"
            role="alert"
            data-testid="export-error-alert"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            data-testid="export-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="export-submit-button"
          >
            {loading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
