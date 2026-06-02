'use client';

import type { CurrencyDisplay } from '../../store/slices/uiSlice';

export interface CurrencyToggleProps {
  currency: CurrencyDisplay;
  onChange: (currency: CurrencyDisplay) => void;
}

export default function CurrencyToggle({ currency, onChange }: CurrencyToggleProps) {
  return (
    <div
      className="inline-flex rounded-md shadow-sm"
      role="group"
      aria-label="Currency display toggle"
    >
      <button
        type="button"
        onClick={() => onChange('USD')}
        aria-pressed={currency === 'USD'}
        className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
          currency === 'USD'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        USD
      </button>
      <button
        type="button"
        onClick={() => onChange('THB')}
        aria-pressed={currency === 'THB'}
        className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-b border-r ${
          currency === 'THB'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        THB
      </button>
    </div>
  );
}
