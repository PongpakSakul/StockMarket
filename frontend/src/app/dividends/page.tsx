'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchDividends,
  fetchDividendSummary,
  createDividend,
  updateDividend,
  deleteDividend,
} from '@/store/slices/dividendsSlice';
import type { DividendFilters, Dividend } from '@/store/slices/dividendsSlice';
import DividendForm from '@/components/dividends/DividendForm';
import type { DividendFormData } from '@/components/dividends/DividendForm';
import DividendTable from '@/components/dividends/DividendTable';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function DividendsPage() {
  const dispatch = useAppDispatch();
  const { dividends, total, summary, loading } = useAppSelector((s) => s.dividends);
  const { transactions } = useAppSelector((s) => s.transactions);

  const [showForm, setShowForm] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DividendFilters>({});

  // Get unique ticker symbols from user's holdings
  const holdings = [...new Set(transactions.map((t) => t.tickerSymbol))];

  useEffect(() => {
    dispatch(fetchDividends({ ...filters, page, pageSize: 20 }));
    dispatch(fetchDividendSummary('ALL'));
  }, [dispatch, filters, page]);

  const handleAdd = useCallback(() => {
    setEditingDividend(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((dividend: Dividend) => {
    setEditingDividend(dividend);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(deleteDividend(id));
    },
    [dispatch]
  );

  const handleSubmit = useCallback(
    (data: DividendFormData) => {
      if (editingDividend) {
        dispatch(
          updateDividend({
            id: editingDividend.id,
            data: {
              tickerSymbol: data.tickerSymbol,
              dividendDate: data.dividendDate,
              amountPerShare: data.amountPerShare,
              totalAmount: data.totalAmount,
            },
          })
        );
      } else {
        dispatch(
          createDividend({
            tickerSymbol: data.tickerSymbol,
            dividendDate: data.dividendDate,
            amountPerShare: data.amountPerShare,
            totalAmount: data.totalAmount,
            sharesHeld: 0,
          })
        );
      }
      setShowForm(false);
      setEditingDividend(null);
    },
    [dispatch, editingDividend]
  );

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingDividend(null);
  }, []);

  const handleFilterChange = useCallback((newFilters: DividendFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dividends</h1>
        <button
          onClick={handleAdd}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Dividend
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingDividend ? 'Edit Dividend' : 'Record Dividend'}
          </h2>
          <DividendForm
            mode={editingDividend ? 'edit' : 'create'}
            initialValues={
              editingDividend
                ? {
                    tickerSymbol: editingDividend.tickerSymbol,
                    dividendDate: editingDividend.dividendDate,
                    amountPerShare: editingDividend.amountPerShare,
                    totalAmount: editingDividend.totalAmount,
                  }
                : undefined
            }
            holdings={holdings}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Table */}
      {loading && dividends.length === 0 ? (
        <TableSkeleton rows={5} columns={5} />
      ) : (
        <div className="bg-white rounded-lg shadow">
          <DividendTable
            dividends={dividends}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            onFilterChange={handleFilterChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            summary={summary}
          />
        </div>
      )}
    </div>
  );
}
