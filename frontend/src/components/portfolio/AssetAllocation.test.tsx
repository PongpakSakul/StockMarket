import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AssetAllocation, { type AssetAllocationProps } from './AssetAllocation';
import type { AssetAllocation as AssetAllocationType } from '../../store/slices/portfolioSlice';

// Mock recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockPieChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  );
  const MockPie = ({ children, data }: { children: React.ReactNode; data: Array<{ name: string; value: number }> }) => (
    <div data-testid="pie" data-items={JSON.stringify(data)}>{children}</div>
  );
  const MockCell = ({ fill }: { fill: string }) => (
    <div data-testid="cell" data-fill={fill} />
  );
  const MockLegend = ({ content: Content }: { content: (props: { payload?: Array<{ value: string; color: string }> }) => React.ReactNode }) => (
    <div data-testid="legend">
      {Content && <Content payload={[{ value: 'VOO', color: '#3B82F6' }, { value: 'QQQM', color: '#10B981' }]} />}
    </div>
  );
  const MockTooltip = () => <div data-testid="tooltip" />;

  return {
    ResponsiveContainer: MockResponsiveContainer,
    PieChart: MockPieChart,
    Pie: MockPie,
    Cell: MockCell,
    Legend: MockLegend,
    Tooltip: MockTooltip,
  };
});

function createAllocation(overrides: Partial<AssetAllocationType> = {}): AssetAllocationType {
  return {
    tickerSymbol: 'VOO',
    tickerName: 'Vanguard S&P 500 ETF',
    valueUSD: 4500,
    percentage: 60,
    ...overrides,
  };
}

function renderChart(props: Partial<AssetAllocationProps> = {}) {
  const defaultProps: AssetAllocationProps = {
    allocation: [
      createAllocation({ tickerSymbol: 'VOO', percentage: 60 }),
      createAllocation({ tickerSymbol: 'QQQM', tickerName: 'Invesco NASDAQ 100 ETF', valueUSD: 3000, percentage: 40 }),
    ],
    ...props,
  };
  return render(<AssetAllocation {...defaultProps} />);
}

describe('AssetAllocation', () => {
  describe('empty state', () => {
    it('renders empty message when no allocation data', () => {
      renderChart({ allocation: [] });

      expect(screen.getByTestId('allocation-empty')).toBeInTheDocument();
      expect(screen.getByText('No holdings to display allocation.')).toBeInTheDocument();
    });

    it('has status role for empty state', () => {
      renderChart({ allocation: [] });

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not render chart when empty', () => {
      renderChart({ allocation: [] });

      expect(screen.queryByTestId('asset-allocation-chart')).not.toBeInTheDocument();
    });
  });

  describe('chart rendering', () => {
    it('renders the chart container', () => {
      renderChart();

      expect(screen.getByTestId('asset-allocation-chart')).toBeInTheDocument();
    });

    it('renders the chart title', () => {
      renderChart();

      expect(screen.getByText('Asset Allocation')).toBeInTheDocument();
    });

    it('renders a pie chart with data', () => {
      renderChart();

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('pie')).toBeInTheDocument();
    });

    it('passes correct data to pie chart', () => {
      renderChart();

      const pie = screen.getByTestId('pie');
      const data = JSON.parse(pie.getAttribute('data-items') || '[]');
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'VOO', value: 60, fullName: 'Vanguard S&P 500 ETF' });
      expect(data[1]).toEqual({ name: 'QQQM', value: 40, fullName: 'Invesco NASDAQ 100 ETF' });
    });

    it('renders cells with colors', () => {
      renderChart();

      const cells = screen.getAllByTestId('cell');
      expect(cells).toHaveLength(2);
      expect(cells[0]).toHaveAttribute('data-fill', '#3B82F6');
      expect(cells[1]).toHaveAttribute('data-fill', '#10B981');
    });
  });

  describe('legend', () => {
    it('renders legend with ticker symbols', () => {
      renderChart();

      const legend = screen.getByTestId('allocation-legend');
      expect(legend).toBeInTheDocument();
      expect(screen.getByText('VOO')).toBeInTheDocument();
      expect(screen.getByText('QQQM')).toBeInTheDocument();
    });
  });

  describe('single holding', () => {
    it('renders chart with single holding at 100%', () => {
      renderChart({
        allocation: [createAllocation({ tickerSymbol: 'VOO', percentage: 100 })],
      });

      expect(screen.getByTestId('asset-allocation-chart')).toBeInTheDocument();
      const pie = screen.getByTestId('pie');
      const data = JSON.parse(pie.getAttribute('data-items') || '[]');
      expect(data).toHaveLength(1);
      expect(data[0].value).toBe(100);
    });
  });
});
