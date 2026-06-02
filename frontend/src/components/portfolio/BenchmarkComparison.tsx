'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PerformanceDataPoint } from '../../store/slices/portfolioSlice';
import type { TimeRange } from '../../store/slices/chartSlice';
import TimeRangeSelector from '../chart/TimeRangeSelector';

export interface BenchmarkComparisonProps {
  data: PerformanceDataPoint[] | unknown;
  loading?: boolean;
  onTimeRangeChange: (range: TimeRange) => void;
  timeRange?: TimeRange;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function BenchmarkComparison({
  data,
  loading = false,
  onTimeRangeChange,
  timeRange = '1Y',
}: BenchmarkComparisonProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(timeRange);
  const chartPoints = Array.isArray(data) ? data : [];

  function handleRangeChange(range: TimeRange) {
    setSelectedRange(range);
    onTimeRangeChange(range);
  }

  if (loading) {
    return (
      <div
        className="bg-white rounded-lg shadow p-6 animate-pulse"
        aria-label="Loading benchmark comparison"
      >
        <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (chartPoints.length === 0) {
    return (
      <div
        className="bg-white rounded-lg shadow p-6"
        data-testid="benchmark-comparison"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Portfolio vs S&P 500
          </h3>
          <TimeRangeSelector selected={selectedRange} onChange={handleRangeChange} />
        </div>
        <div
          className="text-center py-12 text-gray-500"
          role="status"
          data-testid="benchmark-empty"
        >
          No performance data available for the selected time range.
        </div>
      </div>
    );
  }

  const chartData = chartPoints.map((point) => ({
    date: point.date,
    formattedDate: formatDate(point.date),
    portfolio: point.portfolioReturn,
    benchmark: point.benchmarkReturn,
  }));

  return (
    <div
      className="bg-white rounded-lg shadow p-4"
      data-testid="benchmark-comparison"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Portfolio vs S&P 500
        </h3>
        <TimeRangeSelector selected={selectedRange} onChange={handleRangeChange} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatPercent(value),
              name === 'portfolio' ? 'Portfolio' : 'S&P 500',
            ]}
            labelFormatter={(label: string) => label}
          />
          <Legend
            formatter={(value: string) =>
              value === 'portfolio' ? 'Portfolio' : 'S&P 500'
            }
          />
          <Line
            type="monotone"
            dataKey="portfolio"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            name="portfolio"
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="#9CA3AF"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
            name="benchmark"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
