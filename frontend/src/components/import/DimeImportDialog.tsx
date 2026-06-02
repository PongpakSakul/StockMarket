'use client';

import { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { apiUpload } from '../../store/api';

// ============================================================
// Types
// ============================================================

export interface StructuredTransaction {
  ticker: string;
  date: string;
  price_per_share: number;
  shares: number;
  total_amount: number;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportParseResult {
  transactions: StructuredTransaction[];
  errors: ImportError[];
  totalRows: number;
  successfulRows: number;
}

export interface DuplicateCheckResult {
  duplicates: Array<{
    imported: StructuredTransaction;
    existing: { id: string; tickerSymbol: string; transactionDate: string; pricePerShare: number; shares: number; totalAmount: number };
  }>;
  unique: StructuredTransaction[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  overwritten: number;
}

export type ImportStep = 'upload' | 'preview' | 'duplicates';

export interface DimeImportDialogProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

// ============================================================
// Constants
// ============================================================

const ACCEPTED_EXTENSIONS = ['.csv', '.json'];
const ACCEPTED_MIME_TYPES = ['text/csv', 'application/json', 'application/vnd.ms-excel'];

// ============================================================
// Component
// ============================================================

export default function DimeImportDialog({
  visible,
  onClose,
  onImportComplete,
}: DimeImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite'>('skip');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------

  const resetState = useCallback(() => {
    setStep('upload');
    setFile(null);
    setIsDragging(false);
    setLoading(false);
    setError(null);
    setParseResult(null);
    setDuplicateResult(null);
    setDuplicateAction('skip');
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  function isValidFileType(f: File): boolean {
    const extension = '.' + f.name.split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(extension);
  }

  // --------------------------------------------------------
  // File selection
  // --------------------------------------------------------

  const handleFileSelect = useCallback((selectedFile: File) => {
    setError(null);
    if (!isValidFileType(selectedFile)) {
      setError('Invalid file format. Please upload a CSV or JSON file exported from Dime.');
      setFile(null);
      return;
    }
    setFile(selectedFile);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleClickUploadArea = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // --------------------------------------------------------
  // Upload & Parse
  // --------------------------------------------------------

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await apiUpload<ImportParseResult>('/import/dime', formData);
      setParseResult(result);

      if (result.transactions.length === 0 && result.errors.length > 0) {
        setError('Failed to parse the file. Please check that it is a valid Dime export file.');
        setLoading(false);
        return;
      }

      setStep('preview');
    } catch (err: unknown) {
      const apiError = err as { code?: string; message?: string };
      if (apiError.code === 'UNSUPPORTED_FORMAT') {
        setError('Invalid file format. Please upload a CSV or JSON file exported from Dime.');
      } else {
        setError(apiError.message || 'Failed to parse the file. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [file]);

  // --------------------------------------------------------
  // Duplicate check
  // --------------------------------------------------------

  const handleCheckDuplicates = useCallback(async () => {
    if (!parseResult) return;
    setLoading(true);
    setError(null);

    try {
      const result = await apiUpload<DuplicateCheckResult>(
        '/import/dime/check-duplicates',
        (() => {
          const fd = new FormData();
          fd.append('transactions', JSON.stringify(parseResult.transactions));
          return fd;
        })()
      );
      setDuplicateResult(result);
      setStep('duplicates');
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Failed to check for duplicates. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [parseResult]);

  // --------------------------------------------------------
  // Import
  // --------------------------------------------------------

  const handleImport = useCallback(async () => {
    if (!parseResult) return;
    setLoading(true);
    setError(null);

    try {
      const transactions = duplicateResult
        ? duplicateAction === 'skip'
          ? duplicateResult.unique
          : [...duplicateResult.unique, ...duplicateResult.duplicates.map((d) => d.imported)]
        : parseResult.transactions;

      const formData = new FormData();
      formData.append('transactions', JSON.stringify(transactions));
      formData.append('overwriteDuplicates', String(duplicateAction === 'overwrite'));

      const result = await apiUpload<ImportResult>('/import/dime/confirm', formData);
      onImportComplete?.(result);
      handleClose();
    } catch (err: unknown) {
      const apiError = err as { message?: string };
      setError(apiError.message || 'Failed to import transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [parseResult, duplicateResult, duplicateAction, onImportComplete, handleClose]);

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Dime"
      data-testid="dime-import-dialog"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Import from Dime</h2>
          <span className="text-xs text-gray-500">
            {step === 'upload' && 'Step 1: Select File'}
            {step === 'preview' && 'Step 2: Preview'}
            {step === 'duplicates' && 'Step 3: Duplicates'}
          </span>
        </div>

        {/* Error display */}
        {error && (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3"
            role="alert"
            data-testid="import-error"
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div data-testid="upload-step">
            <div
              className={`mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClickUploadArea}
              data-testid="drop-zone"
              role="button"
              aria-label="Click or drag to upload file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleInputChange}
                className="hidden"
                data-testid="file-input"
              />

              <svg
                className="mb-3 h-10 w-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>

              {file ? (
                <p className="text-sm text-green-700" data-testid="selected-file-name">
                  {file.name}
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Drag & drop your Dime export file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-gray-400">Supports CSV and JSON formats</p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="cancel-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="upload-button"
              >
                {loading ? 'Parsing...' : 'Upload & Parse'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <div data-testid="preview-step">
            {/* Summary */}
            <div className="mb-4 flex items-center gap-4 text-sm">
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-green-800">
                {parseResult.successfulRows} parsed successfully
              </span>
              {parseResult.errors.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-red-800">
                  {parseResult.errors.length} errors
                </span>
              )}
              <span className="text-gray-500">
                {parseResult.totalRows} total rows
              </span>
            </div>

            {/* Preview Table */}
            <div className="mb-4 max-h-64 overflow-y-auto rounded-md border border-gray-200">
              <table className="w-full text-sm" data-testid="preview-table">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Ticker</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Price</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Shares</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parseResult.transactions.map((txn, index) => (
                    <tr key={index} data-testid={`preview-row-${index}`}>
                      <td className="px-3 py-2 font-medium text-gray-900">{txn.ticker}</td>
                      <td className="px-3 py-2 text-gray-600">{txn.date}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        ${txn.price_per_share.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600">{txn.shares}</td>
                      <td className="px-3 py-2 text-right text-gray-600">
                        ${txn.total_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Parse Errors */}
            {parseResult.errors.length > 0 && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3" data-testid="parse-errors">
                <p className="mb-1 text-sm font-medium text-amber-800">Parse errors:</p>
                <ul className="list-disc pl-5 text-xs text-amber-700">
                  {parseResult.errors.map((err, index) => (
                    <li key={index}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="cancel-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCheckDuplicates}
                disabled={loading || parseResult.transactions.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="check-duplicates-button"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Duplicates */}
        {step === 'duplicates' && duplicateResult && (
          <div data-testid="duplicates-step">
            {/* Summary */}
            <div className="mb-4 text-sm">
              {duplicateResult.duplicates.length === 0 ? (
                <p className="text-green-700" data-testid="no-duplicates-message">
                  No duplicate transactions found. All {duplicateResult.unique.length} transactions
                  are new.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-700">
                    Found{' '}
                    <span className="font-semibold text-amber-700">
                      {duplicateResult.duplicates.length} duplicate
                    </span>{' '}
                    and{' '}
                    <span className="font-semibold text-green-700">
                      {duplicateResult.unique.length} new
                    </span>{' '}
                    transactions.
                  </p>

                  {/* Duplicate action selection */}
                  <fieldset className="mt-3">
                    <legend className="text-sm font-medium text-gray-700">
                      How to handle duplicates:
                    </legend>
                    <div className="mt-2 flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="skip"
                          checked={duplicateAction === 'skip'}
                          onChange={() => setDuplicateAction('skip')}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                          data-testid="action-skip"
                        />
                        <span className="text-sm text-gray-700">Skip duplicates</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="overwrite"
                          checked={duplicateAction === 'overwrite'}
                          onChange={() => setDuplicateAction('overwrite')}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                          data-testid="action-overwrite"
                        />
                        <span className="text-sm text-gray-700">Overwrite existing</span>
                      </label>
                    </div>
                  </fieldset>

                  {/* Duplicates table */}
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-amber-200">
                    <table className="w-full text-xs" data-testid="duplicates-table">
                      <thead className="sticky top-0 bg-amber-50">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium text-amber-800">Ticker</th>
                          <th className="px-2 py-1 text-left font-medium text-amber-800">Date</th>
                          <th className="px-2 py-1 text-right font-medium text-amber-800">Price</th>
                          <th className="px-2 py-1 text-right font-medium text-amber-800">Shares</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {duplicateResult.duplicates.map((dup, index) => (
                          <tr key={index} data-testid={`duplicate-row-${index}`}>
                            <td className="px-2 py-1 text-gray-900">{dup.imported.ticker}</td>
                            <td className="px-2 py-1 text-gray-600">{dup.imported.date}</td>
                            <td className="px-2 py-1 text-right text-gray-600">
                              ${dup.imported.price_per_share.toFixed(2)}
                            </td>
                            <td className="px-2 py-1 text-right text-gray-600">
                              {dup.imported.shares}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="cancel-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="import-button"
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
