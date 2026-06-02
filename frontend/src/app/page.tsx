'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPortfolioSummary, fetchAssetAllocation, fetchPortfolioPerformance } from '@/store/slices/portfolioSlice';
import { fetchExchangeRate } from '@/store/slices/exchangeRateSlice';
import { setCurrencyDisplay } from '@/store/slices/uiSlice';
import type { CurrencyDisplay } from '@/store/slices/uiSlice';
import type { TimeRange } from '@/store/slices/chartSlice';
import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard';
import BenchmarkComparison from '@/components/portfolio/BenchmarkComparison';
import { CardSkeleton } from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import StaleRateIndicator from '@/components/ui/StaleRateIndicator';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { summary, allocation, performance, loading, error } = useAppSelector((s) => s.portfolio);
  const { currentRate } = useAppSelector((s) => s.exchangeRate);
  const { currencyDisplay } = useAppSelector((s) => s.ui);
  const [perfRange, setPerfRange] = useState<TimeRange>('1Y');

  useEffect(() => {
    dispatch(fetchPortfolioSummary());
    dispatch(fetchAssetAllocation());
    dispatch(fetchExchangeRate());
    dispatch(fetchPortfolioPerformance({ range: '1Y', benchmark: 'SPY' }));
  }, [dispatch]);

  const handleCurrencyChange = (currency: CurrencyDisplay) => {
    dispatch(setCurrencyDisplay(currency));
  };

  const handleRetry = () => {
    dispatch(fetchPortfolioSummary());
    dispatch(fetchAssetAllocation());
  };

  const handlePerfRangeChange = (range: TimeRange) => {
    setPerfRange(range);
    dispatch(fetchPortfolioPerformance({ range, benchmark: 'SPY' }));
  };

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <ErrorBanner message={error} onRetry={handleRetry} />
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <CardSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        {currentRate?.isStale && (
          <StaleRateIndicator
            rate={currentRate.rate}
            fetchedAt={currentRate.fetchedAt}
            onRetry={() => dispatch(fetchExchangeRate())}
          />
        )}
      </div>

      <PortfolioDashboard
        summary={summary}
        allocation={allocation}
        loading={loading}
        currency={currencyDisplay}
        onCurrencyChange={handleCurrencyChange}
      />

      <BenchmarkComparison
        data={performance?.dataPoints ?? []}
        loading={loading}
        timeRange={perfRange}
        onTimeRangeChange={handlePerfRangeChange}
      />
    </div>
  );
}
