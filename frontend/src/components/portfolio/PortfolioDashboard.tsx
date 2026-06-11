'use client';

import type { PortfolioSummary, AssetAllocation as AssetAllocationType } from '../../store/slices/portfolioSlice';
import type { CurrencyDisplay } from '../../store/slices/uiSlice';
import CurrencyToggle from './CurrencyToggle';
import AssetAllocation from './AssetAllocation';

export interface PortfolioDashboardProps {
  summary: PortfolioSummary;
  allocation: AssetAllocationType[];
  loading?: boolean;
  currency: CurrencyDisplay;
  onCurrencyChange: (currency: CurrencyDisplay) => void;
}

function formatCurrency(value: number, currency: 'USD' | 'THB'): string {
  if (currency === 'USD') {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function plColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Loading portfolio data">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-4">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioDashboard({
  summary,
  allocation,
  loading = false,
  currency,
  onCurrencyChange,
}: PortfolioDashboardProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  const totalValue = currency === 'USD' ? summary.totalValueUSD : summary.totalValueTHB;
  const unrealizedPL = currency === 'USD' ? summary.unrealizedPLUSD : summary.unrealizedPLTHB;

  return (
    <div className="space-y-6">
      {/* Currency Toggle */}
      <div className="flex justify-end">
        <CurrencyToggle currency={currency} onChange={onCurrencyChange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Portfolio Value</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900" data-testid="total-value">
            {formatCurrency(totalValue, currency)}
          </p>
        </div>

        {/* Unrealized P/L */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Unrealized P/L</h3>
          <p className={`mt-1 text-2xl font-semibold ${plColor(unrealizedPL)}`} data-testid="unrealized-pl">
            {formatCurrency(unrealizedPL, currency)}
          </p>
          <p className={`text-sm ${plColor(summary.unrealizedPLPercent)}`} data-testid="unrealized-pl-percent">
            {formatPercent(summary.unrealizedPLPercent)}
          </p>
        </div>

        {/* Total Return */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Return</h3>
          <p className={`mt-1 text-2xl font-semibold ${plColor(summary.totalReturnUSD)}`} data-testid="total-return">
            {formatCurrency(summary.totalReturnUSD, 'USD')}
          </p>
          <p className={`text-sm ${plColor(summary.totalReturnPercent)}`} data-testid="total-return-percent">
            {formatPercent(summary.totalReturnPercent)}
          </p>
        </div>

        {/* Dividend Yield */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Dividend Yield</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900" data-testid="dividend-yield">
            {summary.dividendYieldPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3" data-testid="exchange-rate-info">
        <span className="text-sm text-gray-600">
          USD/THB: <span className="font-medium" data-testid="exchange-rate-value">{summary.exchangeRate.rate.toFixed(2)}</span>
        </span>
        <span className="text-xs text-gray-400" data-testid="exchange-rate-updated">
          Updated: {formatTimestamp(summary.exchangeRate.fetchedAt)}
        </span>
        {summary.exchangeRate.isStale && (
          <span
            className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
            data-testid="stale-indicator"
          >
            Stale
          </span>
        )}
      </div>

      {/* Asset Allocation Chart */}
      <AssetAllocation allocation={allocation} />

      {/* Holdings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Holdings</h3>
        </div>
        {summary.holdings.length === 0 ? (
          <div className="text-center py-8 text-gray-500" role="status">
            No holdings found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" aria-label="Holdings table">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shares
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Cost Basis
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unrealized P/L
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.holdings.map((holding) => (
                  <tr key={holding.tickerSymbol}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {holding.tickerSymbol}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                      {holding.totalShares}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                      ${holding.averageCostBasis.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                      ${holding.currentPrice.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${plColor(holding.unrealizedPLUSD)}`}>
                      {formatCurrency(holding.unrealizedPLUSD, 'USD')} ({formatPercent(holding.unrealizedPLPercent)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
