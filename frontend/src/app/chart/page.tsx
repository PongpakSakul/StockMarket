'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchStockPrices,
  fetchBuyPoints,
  setSelectedTicker,
  setTimeRange,
} from '@/store/slices/chartSlice';
import type { TimeRange, BuyPoint } from '@/store/slices/chartSlice';
import StockChart from '@/components/chart/StockChart';
import TickerSearch from '@/components/chart/TickerSearch';
import TimeRangeSelector from '@/components/chart/TimeRangeSelector';
import TransactionDetailPanel from '@/components/chart/TransactionDetailPanel';
import ChartErrorBanner from '@/components/chart/ChartErrorBanner';
import { ChartSkeleton } from '@/components/ui/Skeleton';

export default function ChartPage() {
  const dispatch = useAppDispatch();
  const {
    selectedTicker,
    timeRange,
    priceData,
    buyPoints,
    stockInfo,
    loading,
    error,
  } = useAppSelector((s) => s.chart);

  const [selectedBuyPoint, setSelectedBuyPoint] = useState<BuyPoint | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    if (selectedTicker) {
      dispatch(fetchStockPrices({ ticker: selectedTicker, range: timeRange }));
      dispatch(fetchBuyPoints(selectedTicker));
    }
  }, [dispatch, selectedTicker, timeRange]);

  const handleTickerSelect = useCallback(
    (ticker: string) => {
      dispatch(setSelectedTicker(ticker));
    },
    [dispatch]
  );

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      dispatch(setTimeRange(range));
    },
    [dispatch]
  );

  const handleRetry = useCallback(() => {
    if (selectedTicker) {
      dispatch(fetchStockPrices({ ticker: selectedTicker, range: timeRange }));
    }
  }, [dispatch, selectedTicker, timeRange]);

  const handleBuyPointClick = useCallback((bp: BuyPoint) => {
    setSelectedBuyPoint(bp);
    setPanelVisible(true);
  }, []);

  const handlePanelClose = useCallback(() => {
    setPanelVisible(false);
    setSelectedBuyPoint(null);
  }, []);

  // Compute average cost basis from buy points
  const averageCostBasis =
    buyPoints.length > 0
      ? buyPoints.reduce((sum, bp) => sum + bp.totalAmount, 0) /
        buyPoints.reduce((sum, bp) => sum + bp.shares, 0)
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Stock Chart</h1>
      </div>

      {/* Search and time range controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 max-w-sm">
          <TickerSearch onSelect={handleTickerSelect} />
        </div>
        <TimeRangeSelector selected={timeRange} onChange={handleTimeRangeChange} />
      </div>

      {/* Stock info header */}
      {stockInfo && (
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-semibold text-gray-900">{stockInfo.ticker}</span>
          <span className="text-sm text-gray-500">{stockInfo.name}</span>
          <span className="text-lg font-medium text-gray-900">
            ${stockInfo.currentPrice.toFixed(2)}
          </span>
        </div>
      )}

      {/* Error state */}
      {error && <ChartErrorBanner message={error} onRetry={handleRetry} />}

      {/* Chart area */}
      {loading && !priceData.length ? (
        <ChartSkeleton />
      ) : selectedTicker && priceData.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-4">
          <StockChart
            ticker={selectedTicker}
            timeRange={timeRange}
            buyPoints={buyPoints}
            averageCostBasis={averageCostBasis}
            priceData={priceData}
            loading={loading}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <p className="text-lg">Search for a stock or ETF to view its chart</p>
          <p className="mt-2 text-sm">Try searching for VOO, AAPL, QQQM, or MSFT</p>
        </div>
      )}

      {/* Transaction detail side panel */}
      <TransactionDetailPanel
        buyPoint={selectedBuyPoint}
        visible={panelVisible}
        onClose={handlePanelClose}
      />
    </div>
  );
}
