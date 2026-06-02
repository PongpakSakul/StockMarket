'use client';

import { useEffect, useRef } from 'react';
import type { BuyPoint } from '@/store/slices/chartSlice';

export interface TransactionDetailPanelProps {
  buyPoint: BuyPoint | null;
  visible: boolean;
  onClose: () => void;
}

export default function TransactionDetailPanel({
  buyPoint,
  visible,
  onClose,
}: TransactionDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible || !buyPoint) return null;

  return (
    <div
      ref={panelRef}
      data-testid="transaction-detail-panel"
      className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl border-l border-gray-200 z-50 transform transition-transform duration-300 ease-in-out"
      style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      role="dialog"
      aria-label="Transaction Details"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Transaction Details
        </h2>
        <button
          onClick={onClose}
          data-testid="panel-close-button"
          className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Date */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">
            Purchase Date
          </div>
          <div className="text-lg font-semibold text-gray-800 mt-1">
            {buyPoint.date}
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="space-y-3">
          <DetailRow label="Shares" value={buyPoint.shares.toFixed(6)} />
          <DetailRow
            label="Price per Share"
            value={`$${buyPoint.pricePerShare.toFixed(2)}`}
          />
          <DetailRow
            label="Total Investment"
            value={`$${buyPoint.totalAmount.toFixed(2)}`}
            highlight
          />
        </div>

        {/* Transaction Count */}
        {buyPoint.transactionCount > 1 && (
          <div className="bg-gray-50 rounded-lg p-3 mt-4">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Aggregated Transactions
            </div>
            <div className="text-sm text-gray-700 mt-1">
              This marker represents{' '}
              <span className="font-semibold text-blue-600">
                {buyPoint.transactionCount}
              </span>{' '}
              transactions on the same date.
            </div>
          </div>
        )}

        {/* Average Price Info */}
        {buyPoint.transactionCount > 1 && (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Weighted Average
            </div>
            <DetailRow
              label="Avg Price/Share"
              value={`$${buyPoint.pricePerShare.toFixed(2)}`}
            />
            <DetailRow
              label="Total Shares"
              value={buyPoint.shares.toFixed(6)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={`text-sm font-medium ${highlight ? 'text-green-700' : 'text-gray-800'}`}
      >
        {value}
      </span>
    </div>
  );
}
