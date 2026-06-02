import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BenchmarkComparison, { type BenchmarkComparisonProps } from './BenchmarkComparison';
import type { PerformanceDataPoint } from '../../store/slices/portfolioSlice';

// Mock recharts
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockLineChart = ({ children, data }: { children: React.ReactNode; data: Array<Record<string, unknown>> }) => (
    <div data-testid="line-chart" data-points={data.length}>{children}</div>
  );
  const MockLine = ({ dataKey, stroke, name }: { dataKey: string; stroke: string; name: string }) => (
    <div data-testid={`line-${dataKey}`} data-stroke={stroke} data-name={name} />
  );
  const MockXAxis = () => <div data-testid="x-axis" />;
  const MockYAxis = () => <div data-testid="y-axis" />;
  const MockCartesianGrid = () => <div data-testid="cartesian-grid" />;
  const MockTooltip = () => <div data-testid="chart-tooltip" />;
  const MockLegend = () => <div data-testid="chart-legend" />;

  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockLineChart,
    Line: MockLine,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
    Legend: MockLegend,
  };
});

function createPerformanceData(count = 5): PerformanceDataPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-0${i + 1}-15`,
    portfolioReturn: (i + 1) * 2.5,
    benchmarkReturn: (i + 1) * 1.8,
  }));
}

function renderChart(props: Partial<BenchmarkComparisonProps> = {}) {
  const defaultProps: BenchmarkComparisonProps = {
    data: createPerformanceData(),
    onTimeRangeChange: vi.fn(),
    ...props,
  };
  return {
    ...render(<BenchmarkComparison {...defaultProps} />),
    onTimeRangeChange: defaultProps.onTimeRangeChange,
  };
}

describe('BenchmarkComparison', () => {
  describe('loading state', () => {
    it('renders loading skeleton when loading', () => {
      renderChart({ loading: true });

      expect(screen.getByLabelText('Loading benchmark comparison')).toBeInTheDocument();
    });

    it('does not render chart content when loading', () => {
      renderChart({ loading: true });

      expect(screen.queryByTestId('benchmark-comparison')).not.toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      renderChart({ data: [] });

      expect(screen.getByTestId('benchmark-empty')).toBeInTheDocument();
      expect(screen.getByText('No performance data available for the selected time range.')).toBeInTheDocument();
    });

    it('still renders the title and time range selector when empty', () => {
      renderChart({ data: [] });

      expect(screen.getByText('Portfolio vs S&P 500')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Time range selector' })).toBeInTheDocument();
    });

    it('has status role for empty state', () => {
      renderChart({ data: [] });

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('chart rendering', () => {
    it('renders the chart container', () => {
      renderChart();

      expect(screen.getByTestId('benchmark-comparison')).toBeInTheDocument();
    });

    it('renders the title', () => {
      renderChart();

      expect(screen.getByText('Portfolio vs S&P 500')).toBeInTheDocument();
    });

    it('renders a line chart with data points', () => {
      renderChart({ data: createPerformanceData(7) });

      const chart = screen.getByTestId('line-chart');
      expect(chart).toBeInTheDocument();
      expect(chart).toHaveAttribute('data-points', '7');
    });

    it('renders portfolio line with blue color', () => {
      renderChart();

      const portfolioLine = screen.getByTestId('line-portfolio');
      expect(portfolioLine).toHaveAttribute('data-stroke', '#3B82F6');
      expect(portfolioLine).toHaveAttribute('data-name', 'portfolio');
    });

    it('renders benchmark line with gray color', () => {
      renderChart();

      const benchmarkLine = screen.getByTestId('line-benchmark');
      expect(benchmarkLine).toHaveAttribute('data-stroke', '#9CA3AF');
      expect(benchmarkLine).toHaveAttribute('data-name', 'benchmark');
    });

    it('renders chart axes and grid', () => {
      renderChart();

      expect(screen.getByTestId('x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis')).toBeInTheDocument();
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    });

    it('renders tooltip and legend', () => {
      renderChart();

      expect(screen.getByTestId('chart-tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('chart-legend')).toBeInTheDocument();
    });
  });

  describe('time range selector', () => {
    it('renders time range selector', () => {
      renderChart();

      expect(screen.getByRole('group', { name: 'Time range selector' })).toBeInTheDocument();
    });

    it('defaults to 1Y time range', () => {
      renderChart();

      expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('uses provided timeRange prop as initial selection', () => {
      renderChart({ timeRange: '3M' });

      expect(screen.getByRole('button', { name: '3M' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onTimeRangeChange when a range is selected', () => {
      const { onTimeRangeChange } = renderChart();

      fireEvent.click(screen.getByRole('button', { name: '3M' }));

      expect(onTimeRangeChange).toHaveBeenCalledWith('3M');
    });

    it('updates visual selection when range is clicked', () => {
      renderChart();

      fireEvent.click(screen.getByRole('button', { name: '6M' }));

      expect(screen.getByRole('button', { name: '6M' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '1Y' })).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
