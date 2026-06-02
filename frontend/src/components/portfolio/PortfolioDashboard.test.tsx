import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PortfolioDashboard, { type PortfolioDashboardProps } from './PortfolioDashboard';
import type { PortfolioSummary, Holding, AssetAllocation } from '../../store/slices/portfolioSlice';

// Mock recharts to avoid rendering issues in jsdom
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  const MockPieChart = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  );
  const MockPie = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie">{children}</div>
  );
  const MockCell = () => <div data-testid="cell" />;
  const MockLegend = () => <div data-testid="legend" />;
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

function createHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    tickerSymbol: 'VOO',
    tickerName: 'Vanguard S&P 500 ETF',
    totalShares: 10,
    averageCostBasis: 400.0,
    currentPrice: 450.0,
    currentValueUSD: 4500.0,
    unrealizedPLUSD: 500.0,
    unrealizedPLPercent: 12.5,
    allocationPercent: 60,
    totalDividends: 50.0,
    totalReturnUSD: 550.0,
    totalReturnPercent: 13.75,
    ...overrides,
  };
}

function createSummary(overrides: Partial<PortfolioSummary> = {}): PortfolioSummary {
  return {
    totalValueUSD: 7500.0,
    totalValueTHB: 262500.0,
    totalCostBasis: 6000.0,
    unrealizedPLUSD: 1500.0,
    unrealizedPLTHB: 52500.0,
    unrealizedPLPercent: 25.0,
    totalDividendsReceived: 120.0,
    totalReturnUSD: 1620.0,
    totalReturnPercent: 27.0,
    dividendYieldPercent: 1.6,
    exchangeRate: {
      currencyPair: 'USD_THB',
      rate: 35.0,
      fetchedAt: '2024-06-15T10:30:00Z',
      isStale: false,
    },
    holdings: [
      createHolding({ tickerSymbol: 'VOO', totalShares: 10, averageCostBasis: 400.0, currentPrice: 450.0, unrealizedPLUSD: 500.0, unrealizedPLPercent: 12.5 }),
      createHolding({ tickerSymbol: 'QQQM', totalShares: 5, averageCostBasis: 160.0, currentPrice: 200.0, unrealizedPLUSD: 200.0, unrealizedPLPercent: 25.0 }),
    ],
    ...overrides,
  };
}

function renderDashboard(props: Partial<PortfolioDashboardProps> = {}) {
  const defaultProps: PortfolioDashboardProps = {
    summary: createSummary(),
    allocation: [
      { tickerSymbol: 'VOO', tickerName: 'Vanguard S&P 500 ETF', valueUSD: 4500, percentage: 60 },
      { tickerSymbol: 'QQQM', tickerName: 'Invesco NASDAQ 100 ETF', valueUSD: 3000, percentage: 40 },
    ],
    currency: 'USD',
    onCurrencyChange: vi.fn(),
    ...props,
  };
  return { ...render(<PortfolioDashboard {...defaultProps} />), onCurrencyChange: defaultProps.onCurrencyChange };
}

describe('PortfolioDashboard', () => {
  describe('loading state', () => {
    it('renders loading skeleton when loading is true', () => {
      renderDashboard({ loading: true });

      expect(screen.getByLabelText('Loading portfolio data')).toBeInTheDocument();
      expect(screen.queryByTestId('total-value')).not.toBeInTheDocument();
    });
  });

  describe('total portfolio value', () => {
    it('displays total value in USD when currency is USD', () => {
      renderDashboard({ currency: 'USD' });

      expect(screen.getByTestId('total-value')).toHaveTextContent('$7,500.00');
    });

    it('displays total value in THB when currency is THB', () => {
      renderDashboard({ currency: 'THB' });

      expect(screen.getByTestId('total-value')).toHaveTextContent('฿262,500.00');
    });
  });

  describe('unrealized P/L', () => {
    it('displays unrealized P/L amount in USD', () => {
      renderDashboard({ currency: 'USD' });

      expect(screen.getByTestId('unrealized-pl')).toHaveTextContent('$1,500.00');
    });

    it('displays unrealized P/L amount in THB', () => {
      renderDashboard({ currency: 'THB' });

      expect(screen.getByTestId('unrealized-pl')).toHaveTextContent('฿52,500.00');
    });

    it('displays unrealized P/L percentage', () => {
      renderDashboard();

      expect(screen.getByTestId('unrealized-pl-percent')).toHaveTextContent('+25.00%');
    });

    it('shows green color for positive P/L', () => {
      renderDashboard({ summary: createSummary({ unrealizedPLUSD: 100 }) });

      expect(screen.getByTestId('unrealized-pl')).toHaveClass('text-green-600');
    });

    it('shows red color for negative P/L', () => {
      renderDashboard({
        summary: createSummary({ unrealizedPLUSD: -500, unrealizedPLPercent: -10 }),
      });

      expect(screen.getByTestId('unrealized-pl')).toHaveClass('text-red-600');
    });
  });

  describe('total return', () => {
    it('displays total return amount', () => {
      renderDashboard();

      expect(screen.getByTestId('total-return')).toHaveTextContent('$1,620.00');
    });

    it('displays total return percentage', () => {
      renderDashboard();

      expect(screen.getByTestId('total-return-percent')).toHaveTextContent('+27.00%');
    });
  });

  describe('dividend yield', () => {
    it('displays dividend yield percentage', () => {
      renderDashboard();

      expect(screen.getByTestId('dividend-yield')).toHaveTextContent('1.60%');
    });
  });

  describe('exchange rate info', () => {
    it('displays exchange rate value', () => {
      renderDashboard();

      expect(screen.getByTestId('exchange-rate-value')).toHaveTextContent('35.0000');
    });

    it('displays last updated timestamp', () => {
      renderDashboard();

      expect(screen.getByTestId('exchange-rate-updated')).toHaveTextContent('Updated:');
      // The timestamp should contain the formatted date
      expect(screen.getByTestId('exchange-rate-updated').textContent).toContain('Jun');
      expect(screen.getByTestId('exchange-rate-updated').textContent).toContain('2024');
    });

    it('does not show stale indicator when rate is fresh', () => {
      renderDashboard();

      expect(screen.queryByTestId('stale-indicator')).not.toBeInTheDocument();
    });

    it('shows stale indicator when rate is stale', () => {
      renderDashboard({
        summary: createSummary({
          exchangeRate: {
            currencyPair: 'USD_THB',
            rate: 35.0,
            fetchedAt: '2024-06-14T08:00:00Z',
            isStale: true,
          },
        }),
      });

      const staleIndicator = screen.getByTestId('stale-indicator');
      expect(staleIndicator).toBeInTheDocument();
      expect(staleIndicator).toHaveTextContent('Stale');
      expect(staleIndicator).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  describe('holdings table', () => {
    it('renders holdings table with correct headers', () => {
      renderDashboard();

      const table = screen.getByRole('table', { name: 'Holdings table' });
      expect(table).toBeInTheDocument();

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveTextContent('Ticker');
      expect(headers[1]).toHaveTextContent('Shares');
      expect(headers[2]).toHaveTextContent('Avg Cost Basis');
      expect(headers[3]).toHaveTextContent('Current Price');
      expect(headers[4]).toHaveTextContent('Unrealized P/L');
    });

    it('renders holding data in rows', () => {
      renderDashboard();

      expect(screen.getByText('VOO')).toBeInTheDocument();
      expect(screen.getByText('QQQM')).toBeInTheDocument();
      expect(screen.getByText('$400.00')).toBeInTheDocument();
      expect(screen.getByText('$450.00')).toBeInTheDocument();
    });

    it('displays average cost basis for each holding', () => {
      renderDashboard();

      expect(screen.getByText('$400.00')).toBeInTheDocument();
      expect(screen.getByText('$160.00')).toBeInTheDocument();
    });

    it('displays unrealized P/L with percentage for each holding', () => {
      renderDashboard();

      // VOO: $500.00 (+12.50%)
      expect(screen.getByText(/\$500\.00/)).toBeInTheDocument();
      expect(screen.getByText(/\+12\.50%/)).toBeInTheDocument();
    });

    it('renders empty state when no holdings', () => {
      renderDashboard({ summary: createSummary({ holdings: [] }) });

      expect(screen.getByText('No holdings found.')).toBeInTheDocument();
    });
  });

  describe('currency toggle integration', () => {
    it('renders the currency toggle', () => {
      renderDashboard();

      expect(screen.getByRole('group', { name: 'Currency display toggle' })).toBeInTheDocument();
    });

    it('calls onCurrencyChange when THB is clicked', () => {
      const { onCurrencyChange } = renderDashboard({ currency: 'USD' });

      fireEvent.click(screen.getByRole('button', { name: 'THB' }));

      expect(onCurrencyChange).toHaveBeenCalledWith('THB');
    });

    it('calls onCurrencyChange when USD is clicked', () => {
      const { onCurrencyChange } = renderDashboard({ currency: 'THB' });

      fireEvent.click(screen.getByRole('button', { name: 'USD' }));

      expect(onCurrencyChange).toHaveBeenCalledWith('USD');
    });
  });

  describe('asset allocation chart integration', () => {
    it('renders the asset allocation chart', () => {
      renderDashboard();

      expect(screen.getByTestId('asset-allocation-chart')).toBeInTheDocument();
    });

    it('renders empty allocation state when no allocation data', () => {
      renderDashboard({ allocation: [] });

      expect(screen.getByTestId('allocation-empty')).toBeInTheDocument();
    });
  });
});
