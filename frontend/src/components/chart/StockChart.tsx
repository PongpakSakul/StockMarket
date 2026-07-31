'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  ColorType,
  SeriesMarker,
} from 'lightweight-charts';
import type { TimeRange, OHLCData, BuyPoint } from '@/store/slices/chartSlice';

export interface StockChartProps {
  ticker: string;
  timeRange: TimeRange;
  buyPoints: BuyPoint[];
  averageCostBasis?: number;
  priceData?: OHLCData[];
  loading?: boolean;
}

function formatOHLCData(data: OHLCData[]): CandlestickData<Time>[] {
  const map = new Map<string | number, CandlestickData<Time>>();

  data.forEach((d) => {
    map.set(d.time, {
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });
}

function createBuyPointMarkers(buyPoints: BuyPoint[]): SeriesMarker<Time>[] {
  const sorted = [...buyPoints].sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  return sorted.map((bp) => ({
    time: bp.date as Time,
    position: 'belowBar' as const,
    color: '#2196F3',
    shape: 'arrowUp' as const,
    text: bp.transactionCount > 1
      ? `Buy x${bp.transactionCount}`
      : `Buy $${bp.pricePerShare.toFixed(2)}`,
  }));
}

export default function StockChart({
  ticker,
  timeRange,
  buyPoints,
  averageCostBasis,
  priceData = [],
  loading = false,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const initChart = useCallback(() => {
    if (!chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#e1e1e1' },
        horzLines: { color: '#e1e1e1' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: '#cccccc',
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    return chart;
  }, []);

  // Initialize chart on mount
  useEffect(() => {
    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      }
    };
  }, [initChart]);

  // Update data when priceData changes
  useEffect(() => {
    if (!candlestickSeriesRef.current || priceData.length === 0) return;

    const formattedData = formatOHLCData(priceData);
    candlestickSeriesRef.current.setData(formattedData);

    // Add buy point markers
    if (buyPoints.length > 0) {
      const markers = createBuyPointMarkers(buyPoints);
      candlestickSeriesRef.current.setMarkers(markers);
    }

    // Draw average cost basis horizontal line
    if (averageCostBasis !== undefined && averageCostBasis > 0) {
      candlestickSeriesRef.current.createPriceLine({
        price: averageCostBasis,
        color: '#FF9800',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Avg Cost',
      });
    }

    // Fit content to view
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [priceData, buyPoints, averageCostBasis]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Loading chart data for {ticker}...</p>
        </div>
      </div>
    );
  }

  if (priceData.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            No price data available for {ticker} ({timeRange})
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Try selecting a different time range or search for another ticker.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        ref={chartContainerRef}
        data-testid="stock-chart-container"
        className="w-full rounded-lg border border-gray-200 overflow-hidden"
      />
    </div>
  );
}
