import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StockChart from './StockChart';
import type { OHLCData, BuyPoint } from '@/store/slices/chartSlice';

// Mock lightweight-charts since it requires canvas/DOM APIs not available in jsdom
const mockSetData = vi.fn();
const mockSetMarkers = vi.fn();
const mockCreatePriceLine = vi.fn();
const mockFitContent = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemove = vi.fn();
const mockTimeScale = vi.fn(() => ({ fitContent: mockFitContent }));

const mockAddCandlestickSeries = vi.fn(() => ({
  setData: mockSetData,
  setMarkers: mockSetMarkers,
  createPriceLine: mockCreatePriceLine,
}));

const mockCreateChart = vi.fn(() => ({
  addCandlestickSeries: mockAddCandlestickSeries,
  timeScale: mockTimeScale,
  applyOptions: mockApplyOptions,
  remove: mockRemove,
}));

vi.mock('lightweight-charts', () => ({
  createChart: (...args: unknown[]) => mockCreateChart(...args),
  ColorType: { Solid: 'solid' },
}));

describe('StockChart', () => {
  const samplePriceData: OHLCData[] = [
    { time: '2024-01-02', open: 100, high: 105, low: 99, close: 103, volume: 1000000 },
    { time: '2024-01-03', open: 103, high: 108, low: 102, close: 107, volume: 1200000 },
    { time: '2024-01-04', open: 107, high: 110, low: 105, close: 109, volume: 900000 },
  ];

  const sampleBuyPoints: BuyPoint[] = [
    { date: '2024-01-02', pricePerShare: 100, shares: 10, totalAmount: 1000, transactionCount: 1 },
    { date: '2024-01-04', pricePerShare: 107, shares: 5, totalAmount: 535, transactionCount: 2 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        loading={true}
      />
    );

    expect(screen.getByText(/Loading chart data for VOO/)).toBeInTheDocument();
  });

  it('renders empty state when no price data', () => {
    render(
      <StockChart
        ticker="QQQM"
        timeRange="3M"
        buyPoints={[]}
        priceData={[]}
      />
    );

    expect(screen.getByText(/No price data available for QQQM/)).toBeInTheDocument();
  });

  it('creates chart when price data is provided', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        priceData={samplePriceData}
      />
    );

    expect(mockCreateChart).toHaveBeenCalled();
    expect(mockAddCandlestickSeries).toHaveBeenCalled();
    expect(mockSetData).toHaveBeenCalledWith(
      samplePriceData.map((d) => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );
  });

  it('sets buy point markers on the chart', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={sampleBuyPoints}
        priceData={samplePriceData}
      />
    );

    expect(mockSetMarkers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          time: '2024-01-02',
          position: 'belowBar',
          color: '#2196F3',
          shape: 'arrowUp',
        }),
        expect.objectContaining({
          time: '2024-01-04',
          text: 'Buy x2',
        }),
      ])
    );
  });

  it('draws average cost basis price line', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        priceData={samplePriceData}
        averageCostBasis={104.5}
      />
    );

    expect(mockCreatePriceLine).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 104.5,
        title: 'Avg Cost',
      })
    );
  });

  it('does not draw price line when averageCostBasis is undefined', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        priceData={samplePriceData}
      />
    );

    expect(mockCreatePriceLine).not.toHaveBeenCalled();
  });

  it('renders chart container element', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        priceData={samplePriceData}
      />
    );

    expect(screen.getByTestId('stock-chart-container')).toBeInTheDocument();
  });

  it('fits content to view after setting data', () => {
    render(
      <StockChart
        ticker="VOO"
        timeRange="1Y"
        buyPoints={[]}
        priceData={samplePriceData}
      />
    );

    expect(mockFitContent).toHaveBeenCalled();
  });
});
