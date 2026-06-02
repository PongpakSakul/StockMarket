'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Dividend, DividendFilters } from '../../store/slices/dividendsSlice';

export interface DividendTableProps {
  dividends: Dividend[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: DividendFilters) => void;
  onEdit: (dividend: Dividend) => void;
  onDelete: (id: string) => void;
  summary?: {
    totalDividends: number;
    dividendsByTicker: Record<string, number>;
  } | null;
}

export default function DividendTable({
  dividends,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onFilterChange,
  onEdit,
  onDelete,
  summary,
}: DividendTableProps) {
  const [tickerFilter, setTickerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleFilterApply = useCallback(() => {
    const filters: DividendFilters = {};
    if (tickerFilter.trim()) {
      filters.tickerSymbol = tickerFilter.trim().toUpperCase();
    }
    if (fromDate) {
      filters.fromDate = fromDate;
    }
    if (toDate) {
      filters.toDate = toDate;
    }
    onFilterChange(filters);
  }, [tickerFilter, fromDate, toDate, onFilterChange]);

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  // Compute cumulative total for displayed dividends (from summary or from data)
  const cumulativeTotal = useMemo(() => {
    if (summary) {
      return Number(summary.totalDividends ?? 0);
    }
    return dividends.reduce((sum, d) => sum + Number(d.totalAmount ?? 0), 0);
  }, [summary, dividends]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end" role="group" aria-label="Dividend filters">
        <div>
          <label htmlFor="dividend-filter-ticker" className="block text-sm font-medium text-gray-700">
            Ticker
          </label>
          <input
            id="dividend-filter-ticker"
            type="text"
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            placeholder="e.g. VOO"
            className="mt-1 block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="dividend-filter-from-date" className="block text-sm font-medium text-gray-700">
            From
          </label>
          <input
            id="dividend-filter-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="dividend-filter-to-date" className="block text-sm font-medium text-gray-700">
            To
          </label>
          <input
            id="dividend-filter-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={handleFilterApply}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Apply Filters
        </button>
      </div>

      {/* Cumulative Dividend Summary */}
      <div
        className="rounded-md bg-green-50 border border-green-200 px-4 py-3"
        role="region"
        aria-label="Dividend summary"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-green-800">
            Cumulative Dividends
          </span>
          <span className="text-lg font-semibold text-green-900">
            ${Number.isFinite(cumulativeTotal) ? cumulativeTotal.toFixed(2) : '0.00'}
          </span>
        </div>
        {summary && summary.dividendsByTicker && Object.keys(summary.dividendsByTicker).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(summary.dividendsByTicker).map(([ticker, amount]) => (
              <span
                key={ticker}
                className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
              >
                  {ticker}: ${Number(amount ?? 0).toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {dividends.length === 0 ? (
        <div className="text-center py-8 text-gray-500" role="status">
          No dividends found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" aria-label="Dividends table">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Ticker
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Amount/Share
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Total Amount
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dividends.map((dividend) => (
                <tr key={dividend.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {dividend.tickerSymbol}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {dividend.dividendDate}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                    ${dividend.amountPerShare.toFixed(6)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                    ${dividend.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    <button
                      type="button"
                      onClick={() => onEdit(dividend)}
                      className="text-blue-600 hover:text-blue-800 font-medium mr-3"
                      aria-label={`Edit dividend ${dividend.tickerSymbol} on ${dividend.dividendDate}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(dividend.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                      aria-label={`Delete dividend ${dividend.tickerSymbol} on ${dividend.dividendDate}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dividend-delete-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 id="dividend-delete-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Delete
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this dividend record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleDeleteCancel}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
