'use client';

import { useState, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

export interface ParsedSlipResult {
  ticker?: string;
  date?: string;
  pricePerShare?: number;
  shares?: number;
  totalAmount?: number;
  missingFields: string[];
  success: boolean;
}

export interface ConfirmationModalProps {
  results: ParsedSlipResult[];
  onConfirm: (selectedResults: ParsedSlipResult[]) => void;
  onCancel: () => void;
  onManualEntry: () => void;
  visible: boolean;
}

// ============================================================
// Helpers
// ============================================================

const FIELD_LABELS: Record<string, string> = {
  ticker: 'Ticker Symbol',
  date: 'Date',
  pricePerShare: 'Price per Share',
  shares: 'Shares',
  totalAmount: 'Total Amount',
};

function allFailed(results: ParsedSlipResult[]): boolean {
  return results.length > 0 && results.every((r) => !r.success);
}

// ============================================================
// Component
// ============================================================

export default function ConfirmationModal({
  results,
  onConfirm,
  onCancel,
  onManualEntry,
  visible,
}: ConfirmationModalProps) {
  const [editedResults, setEditedResults] = useState<ParsedSlipResult[]>(results);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    results.forEach((r, i) => {
      if (r.success) initial.add(i);
    });
    return initial;
  });

  // Sync state when results prop changes
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setEditedResults(results);
    const initial = new Set<number>();
    results.forEach((r, i) => {
      if (r.success) initial.add(i);
    });
    setSelectedIndices(initial);
  }

  const isBatch = results.length > 1;
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  const handleFieldChange = useCallback(
    (index: number, field: keyof ParsedSlipResult, value: string) => {
      setEditedResults((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };

        if (field === 'ticker' || field === 'date') {
          (item as Record<string, unknown>)[field] = value;
        } else if (field === 'pricePerShare' || field === 'shares' || field === 'totalAmount') {
          const numVal = parseFloat(value);
          (item as Record<string, unknown>)[field] = isNaN(numVal) ? undefined : numVal;
        }

        // Remove from missingFields if user filled it
        if (value && item.missingFields.includes(field)) {
          item.missingFields = item.missingFields.filter((f) => f !== field);
        }

        updated[index] = item;
        return updated;
      });
    },
    []
  );

  const handleToggleSelect = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIndices = new Set<number>();
    editedResults.forEach((_, i) => allIndices.add(i));
    setSelectedIndices(allIndices);
  }, [editedResults]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    const selected = editedResults.filter((_, i) => selectedIndices.has(i));
    onConfirm(selected);
  }, [editedResults, selectedIndices, onConfirm]);

  if (!visible) return null;

  // Complete OCR failure case
  if (allFailed(results)) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-label="OCR Results"
        data-testid="confirmation-modal"
      >
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <svg
              className="h-6 w-6 text-red-500"
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
            <h2 className="text-lg font-semibold text-gray-900">OCR Failed</h2>
          </div>

          <p className="mb-6 text-sm text-gray-600" data-testid="ocr-failed-message">
            Unable to read the uploaded slip{results.length > 1 ? 's' : ''}. The image may be
            unclear or in an unsupported format.
          </p>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onManualEntry}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              data-testid="manual-entry-button"
            >
              Enter Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="OCR Results"
      data-testid="confirmation-modal"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isBatch ? 'Batch Upload Results' : 'Confirm Transaction'}
        </h2>

        {/* Batch Summary */}
        {isBatch && (
          <div className="mb-4 flex gap-4 text-sm" data-testid="batch-summary">
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-green-800">
              {successCount} successful
            </span>
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-red-800">
              {failedCount} failed
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs text-blue-600 hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>
        )}

        {/* Results List */}
        <div className="space-y-4">
          {editedResults.map((result, index) => (
            <div
              key={index}
              className={`rounded-md border p-4 ${
                !result.success ? 'border-red-200 bg-red-50' : 'border-gray-200'
              }`}
              data-testid={`result-item-${index}`}
            >
              {/* Batch checkbox */}
              {isBatch && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIndices.has(index)}
                    onChange={() => handleToggleSelect(index)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    aria-label={`Select result ${index + 1}`}
                    data-testid={`checkbox-${index}`}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Slip {index + 1}
                    {!result.success && (
                      <span className="ml-2 text-xs text-red-600">(parse failed)</span>
                    )}
                  </span>
                </div>
              )}

              {/* Editable Fields */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(['ticker', 'date', 'pricePerShare', 'shares', 'totalAmount'] as const).map(
                  (field) => {
                    const isMissing = result.missingFields.includes(field);
                    const value = editedResults[index][field];

                    return (
                      <div key={field} className="relative">
                        <label
                          className={`block text-xs font-medium ${
                            isMissing ? 'text-amber-700' : 'text-gray-600'
                          }`}
                        >
                          {FIELD_LABELS[field]}
                          {isMissing && (
                            <span
                              className="ml-1 text-amber-600"
                              data-testid={`missing-indicator-${index}-${field}`}
                            >
                              (required)
                            </span>
                          )}
                        </label>
                        <input
                          type={
                            field === 'ticker'
                              ? 'text'
                              : field === 'date'
                              ? 'date'
                              : 'number'
                          }
                          value={value ?? ''}
                          onChange={(e) => handleFieldChange(index, field, e.target.value)}
                          className={`mt-1 block w-full rounded-md border px-3 py-1.5 text-sm ${
                            isMissing
                              ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300'
                              : 'border-gray-300'
                          }`}
                          placeholder={isMissing ? 'Enter value' : ''}
                          step={
                            field === 'pricePerShare'
                              ? '0.01'
                              : field === 'shares'
                              ? '0.000001'
                              : field === 'totalAmount'
                              ? '0.01'
                              : undefined
                          }
                          aria-label={`${FIELD_LABELS[field]} for result ${index + 1}`}
                          data-testid={`field-${index}-${field}`}
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIndices.size === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="confirm-button"
          >
            Confirm{isBatch && selectedIndices.size > 0 ? ` (${selectedIndices.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
