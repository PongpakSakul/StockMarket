'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/store/slices/transactionsSlice';
import type { Transaction, TransactionFilters } from '@/store/slices/transactionsSlice';
import TransactionForm from '@/components/transactions/TransactionForm';
import TransactionTable from '@/components/transactions/TransactionTable';
import SlipUploader from '@/components/transactions/SlipUploader';
import ExportDialog from '@/components/export/ExportDialog';
import DimeImportDialog from '@/components/import/DimeImportDialog';
import { TableSkeleton } from '@/components/ui/Skeleton';

type ModalState = 'none' | 'add' | 'edit' | 'upload' | 'export' | 'import';

export default function TransactionsPage() {
  const dispatch = useAppDispatch();
  const { transactions, total, loading } = useAppSelector((s) => s.transactions);
  const [modal, setModal] = useState<ModalState>('none');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    dispatch(fetchTransactions({ ...filters, sortBy: sortBy as any, sortOrder, page, pageSize: 20 }));
  }, [dispatch, filters, page, sortBy, sortOrder]);

  const handleAdd = useCallback(() => setModal('add'), []);
  const handleUpload = useCallback(() => setModal('upload'), []);
  const handleExport = useCallback(() => setModal('export'), []);
  const handleImport = useCallback(() => setModal('import'), []);
  const handleClose = useCallback(() => {
    setModal('none');
    setEditingTransaction(null);
  }, []);

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
    setModal('edit');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      dispatch(deleteTransaction(id));
    },
    [dispatch]
  );

  const handleFilterChange = useCallback((newFilters: TransactionFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
  }, []);

  const handleFormSubmit = useCallback(
    (data: any) => {
      if (modal === 'edit' && editingTransaction) {
        dispatch(updateTransaction({ id: editingTransaction.id, data }));
      } else {
        dispatch(createTransaction(data));
      }
      handleClose();
    },
    [dispatch, modal, editingTransaction, handleClose]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Import from Dime
          </button>
          <button
            onClick={handleExport}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Export
          </button>
          <button
            onClick={handleUpload}
            className="rounded-md border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Upload Slip
          </button>
          <button
            onClick={handleAdd}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Transaction
          </button>
        </div>
      </div>

      {/* Table */}
      {loading && transactions.length === 0 ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <TransactionTable
          transactions={transactions}
          totalCount={total}
          page={page}
          pageSize={20}
          onPageChange={setPage}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Add/Edit Form Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {modal === 'add' ? 'Add Transaction' : 'Edit Transaction'}
            </h2>
            <TransactionForm
              mode={modal === 'add' ? 'create' : 'edit'}
              initialValues={editingTransaction ?? undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleClose}
            />
          </div>
        </div>
      )}

      {/* Slip Upload Modal */}
      {modal === 'upload' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Slip</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </button>
            </div>
            <SlipUploader
              onUploadComplete={(results) => {
                handleClose();
                // Refresh transactions after upload
                dispatch(fetchTransactions({ ...filters, page, pageSize: 20 }));
              }}
            />
          </div>
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog visible={modal === 'export'} onClose={handleClose} />

      {/* Dime Import Dialog */}
      <DimeImportDialog
        visible={modal === 'import'}
        onClose={handleClose}
        onImportComplete={() => {
          handleClose();
          dispatch(fetchTransactions({ ...filters, page, pageSize: 20 }));
        }}
      />
    </div>
  );
}
