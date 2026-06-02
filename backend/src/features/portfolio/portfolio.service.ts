import {
  Transaction,
  Holding,
  PortfolioSummary,
  AssetAllocation,
  ExchangeRate,
  TimeRange,
} from '../../types';

// ────────────────────────────────────────────────────────────
// Types for Portfolio Service
// ────────────────────────────────────────────────────────────

export interface UnrealizedPL {
  tickerSymbol: string;
  unrealizedPLUSD: number;
  unrealizedPLPercent: number;
}

export interface PerformanceDataPoint {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number;
}

export interface PerformanceData {
  range: TimeRange;
  benchmark: string;
  dataPoints: PerformanceDataPoint[];
  portfolioTotalReturn: number;
  benchmarkTotalReturn: number;
}

// ────────────────────────────────────────────────────────────
// Dependencies (interfaces for external services)
// ────────────────────────────────────────────────────────────

export interface ITransactionProvider {
  getTransactionsForUser(userId: string): Promise<Transaction[]>;
  getTransactionsByTicker(userId: string, ticker: string): Promise<Transaction[]>;
}

export interface IPriceProvider {
  getCurrentPrices(tickers: string[]): Promise<Map<string, number>>;
  getTickerName(ticker: string): Promise<string>;
  getHistoricalPrices(ticker: string, range: TimeRange): Promise<Map<string, number>>;
}

export interface IExchangeRateProvider {
  getCurrentRate(): Promise<ExchangeRate>;
}

export interface IDividendProvider {
  getTotalDividendsForUser(userId: string): Promise<number>;
  getDividendsByTicker(userId: string, ticker: string): Promise<number>;
  getAnnualDividends(userId: string): Promise<number>;
}

// ────────────────────────────────────────────────────────────
// Portfolio Service
// ────────────────────────────────────────────────────────────

export class PortfolioService {
  constructor(
    private readonly transactionProvider: ITransactionProvider,
    private readonly priceProvider: IPriceProvider,
    private readonly exchangeRateProvider: IExchangeRateProvider,
    private readonly dividendProvider: IDividendProvider,
  ) {}

  /**
   * Calculate the average cost basis for a set of transactions.
   * Average Cost Basis = sum(total_amount) / sum(shares)
   *
   * Requirements: 2.4, 5.2
   * Property 3: Average Cost Basis = sum(total_amount) / sum(shares)
   */
  calculateAverageCostBasis(transactions: Transaction[]): number {
    if (transactions.length === 0) return 0;

    const totalAmount = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalShares = transactions.reduce((sum, t) => sum + t.shares, 0);

    if (totalShares === 0) return 0;

    return totalAmount / totalShares;
  }

  /**
   * Calculate unrealized P/L for each holding given current prices.
   * Unrealized P/L per holding = (currentPrice - avgCost) × shares
   *
   * Requirements: 5.1, 5.3
   * Property 5: Portfolio value and Unrealized P/L calculations
   */
  calculateUnrealizedPL(
    holdings: Holding[],
    currentPrices: Map<string, number>,
  ): UnrealizedPL[] {
    return holdings.map((holding) => {
      const currentPrice = currentPrices.get(holding.tickerSymbol) ?? holding.currentPrice;
      const unrealizedPLUSD = (currentPrice - holding.averageCostBasis) * holding.totalShares;
      const costBasis = holding.averageCostBasis * holding.totalShares;
      const unrealizedPLPercent = costBasis > 0 ? (unrealizedPLUSD / costBasis) * 100 : 0;

      return {
        tickerSymbol: holding.tickerSymbol,
        unrealizedPLUSD,
        unrealizedPLPercent,
      };
    });
  }

  /**
   * Calculate asset allocation percentages for holdings.
   * Each holding's percentage = (holdingValue / totalPortfolioValue) × 100
   * Percentages must sum to 100% (±0.01% tolerance for rounding).
   *
   * Requirements: 5.4
   * Property 6: Asset allocation percentages sum to 100%
   */
  calculateAllocation(holdings: Holding[]): AssetAllocation[] {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValueUSD, 0);

    if (totalValue === 0) return [];

    const rawAllocations = holdings.map((h) => ({
      tickerSymbol: h.tickerSymbol,
      tickerName: h.tickerName,
      valueUSD: h.currentValueUSD,
      rawPercentage: (h.currentValueUSD / totalValue) * 100,
    }));

    // Use largest remainder method to ensure percentages sum to exactly 100%
    const flooredAllocations = rawAllocations.map((a) => ({
      ...a,
      percentage: Math.floor(a.rawPercentage * 100) / 100, // floor to 2 decimal places
      remainder: (a.rawPercentage * 100 - Math.floor(a.rawPercentage * 100)) / 100,
    }));

    const currentSum = flooredAllocations.reduce((sum, a) => sum + a.percentage, 0);
    let deficit = Math.round((100 - currentSum) * 100) / 100;

    // Distribute the deficit to items with largest remainders
    const sorted = [...flooredAllocations].sort((a, b) => b.remainder - a.remainder);
    for (const item of sorted) {
      if (deficit <= 0) break;
      const increment = Math.min(0.01, deficit);
      item.percentage = Math.round((item.percentage + increment) * 100) / 100;
      deficit = Math.round((deficit - increment) * 100) / 100;
    }

    // Map back to original order
    const percentageMap = new Map(sorted.map((s) => [s.tickerSymbol, s.percentage]));

    return rawAllocations.map((a) => ({
      tickerSymbol: a.tickerSymbol,
      tickerName: a.tickerName,
      valueUSD: a.valueUSD,
      percentage: percentageMap.get(a.tickerSymbol) ?? a.rawPercentage,
    }));
  }

  /**
   * Get portfolio summary including total value, unrealized P/L, total return, and dividend yield.
   *
   * Requirements: 5.1, 5.2, 5.3, 5.5, 5.6
   */
  async getSummary(userId: string): Promise<PortfolioSummary> {
    const transactions = await this.transactionProvider.getTransactionsForUser(userId);

    // Group transactions by ticker
    const transactionsByTicker = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const existing = transactionsByTicker.get(txn.tickerSymbol) ?? [];
      existing.push(txn);
      transactionsByTicker.set(txn.tickerSymbol, existing);
    }

    const tickers = Array.from(transactionsByTicker.keys());
    const currentPrices = await this.priceProvider.getCurrentPrices(tickers);
    const exchangeRate = await this.exchangeRateProvider.getCurrentRate();
    const totalDividendsReceived = await this.dividendProvider.getTotalDividendsForUser(userId);
    const annualDividends = await this.dividendProvider.getAnnualDividends(userId);

    // Build holdings
    const holdings: Holding[] = [];
    let totalValueUSD = 0;
    let totalCostBasis = 0;
    let totalUnrealizedPLUSD = 0;

    for (const [ticker, tickerTransactions] of transactionsByTicker) {
      const avgCost = this.calculateAverageCostBasis(tickerTransactions);
      const totalShares = tickerTransactions.reduce((sum, t) => sum + t.shares, 0);
      const currentPrice = currentPrices.get(ticker) ?? 0;
      const currentValueUSD = totalShares * currentPrice;
      const costBasis = totalShares * avgCost;
      const unrealizedPLUSD = currentValueUSD - costBasis;
      const unrealizedPLPercent = costBasis > 0 ? (unrealizedPLUSD / costBasis) * 100 : 0;
      const tickerDividends = await this.dividendProvider.getDividendsByTicker(userId, ticker);
      const totalReturnUSD = unrealizedPLUSD + tickerDividends;
      const totalReturnPercent = costBasis > 0 ? (totalReturnUSD / costBasis) * 100 : 0;
      const tickerName = await this.priceProvider.getTickerName(ticker);

      holdings.push({
        tickerSymbol: ticker,
        tickerName,
        totalShares,
        averageCostBasis: avgCost,
        currentPrice,
        currentValueUSD,
        unrealizedPLUSD,
        unrealizedPLPercent,
        allocationPercent: 0, // will be calculated below
        totalDividends: tickerDividends,
        totalReturnUSD,
        totalReturnPercent,
      });

      totalValueUSD += currentValueUSD;
      totalCostBasis += costBasis;
      totalUnrealizedPLUSD += unrealizedPLUSD;
    }

    // Calculate allocation percentages
    for (const holding of holdings) {
      holding.allocationPercent = totalValueUSD > 0
        ? (holding.currentValueUSD / totalValueUSD) * 100
        : 0;
    }

    const unrealizedPLPercent = totalCostBasis > 0
      ? (totalUnrealizedPLUSD / totalCostBasis) * 100
      : 0;

    const totalReturnUSD = totalUnrealizedPLUSD + totalDividendsReceived;
    const totalReturnPercent = totalCostBasis > 0
      ? (totalReturnUSD / totalCostBasis) * 100
      : 0;

    const dividendYieldPercent = totalValueUSD > 0
      ? (annualDividends / totalValueUSD) * 100
      : 0;

    return {
      totalValueUSD,
      totalValueTHB: totalValueUSD * exchangeRate.rate,
      totalCostBasis,
      unrealizedPLUSD: totalUnrealizedPLUSD,
      unrealizedPLTHB: totalUnrealizedPLUSD * exchangeRate.rate,
      unrealizedPLPercent,
      totalDividendsReceived,
      totalReturnUSD,
      totalReturnPercent,
      dividendYieldPercent,
      exchangeRate,
      holdings,
    };
  }

  /**
   * Get asset allocation for the portfolio.
   *
   * Requirements: 5.4
   */
  async getAllocation(userId: string): Promise<AssetAllocation[]> {
    const transactions = await this.transactionProvider.getTransactionsForUser(userId);

    // Group transactions by ticker
    const transactionsByTicker = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const existing = transactionsByTicker.get(txn.tickerSymbol) ?? [];
      existing.push(txn);
      transactionsByTicker.set(txn.tickerSymbol, existing);
    }

    const tickers = Array.from(transactionsByTicker.keys());
    const currentPrices = await this.priceProvider.getCurrentPrices(tickers);

    // Build holdings for allocation calculation
    const holdings: Holding[] = [];
    for (const [ticker, tickerTransactions] of transactionsByTicker) {
      const avgCost = this.calculateAverageCostBasis(tickerTransactions);
      const totalShares = tickerTransactions.reduce((sum, t) => sum + t.shares, 0);
      const currentPrice = currentPrices.get(ticker) ?? 0;
      const currentValueUSD = totalShares * currentPrice;
      const tickerName = await this.priceProvider.getTickerName(ticker);

      holdings.push({
        tickerSymbol: ticker,
        tickerName,
        totalShares,
        averageCostBasis: avgCost,
        currentPrice,
        currentValueUSD,
        unrealizedPLUSD: 0,
        unrealizedPLPercent: 0,
        allocationPercent: 0,
        totalDividends: 0,
        totalReturnUSD: 0,
        totalReturnPercent: 0,
      });
    }

    return this.calculateAllocation(holdings);
  }

  /**
   * Get performance comparison between portfolio and a benchmark (e.g., S&P 500).
   *
   * Requirements: 5.5
   */
  async getPerformance(
    userId: string,
    range: TimeRange,
    benchmark: string,
  ): Promise<PerformanceData> {
    const transactions = await this.transactionProvider.getTransactionsForUser(userId);

    // Group transactions by ticker
    const transactionsByTicker = new Map<string, Transaction[]>();
    for (const txn of transactions) {
      const existing = transactionsByTicker.get(txn.tickerSymbol) ?? [];
      existing.push(txn);
      transactionsByTicker.set(txn.tickerSymbol, existing);
    }

    const tickers = Array.from(transactionsByTicker.keys());

    // Get historical prices for portfolio tickers and benchmark
    const benchmarkPrices = await this.priceProvider.getHistoricalPrices(benchmark, range);
    const tickerHistoricalPrices = new Map<string, Map<string, number>>();
    for (const ticker of tickers) {
      const prices = await this.priceProvider.getHistoricalPrices(ticker, range);
      tickerHistoricalPrices.set(ticker, prices);
    }

    // Calculate total cost basis for the portfolio
    let totalCostBasis = 0;
    const holdingShares = new Map<string, number>();
    for (const [ticker, tickerTransactions] of transactionsByTicker) {
      const totalShares = tickerTransactions.reduce((sum, t) => sum + t.shares, 0);
      const avgCost = this.calculateAverageCostBasis(tickerTransactions);
      holdingShares.set(ticker, totalShares);
      totalCostBasis += totalShares * avgCost;
    }

    // Get all dates from benchmark prices (sorted)
    const dates = Array.from(benchmarkPrices.keys()).sort();

    if (dates.length === 0) {
      return {
        range,
        benchmark,
        dataPoints: [],
        portfolioTotalReturn: 0,
        benchmarkTotalReturn: 0,
      };
    }

    // Calculate returns for each date
    const firstBenchmarkPrice = benchmarkPrices.get(dates[0]) ?? 0;
    const dataPoints: PerformanceDataPoint[] = [];

    for (const date of dates) {
      // Portfolio value on this date
      let portfolioValue = 0;
      for (const [ticker, shares] of holdingShares) {
        const tickerPrices = tickerHistoricalPrices.get(ticker);
        const price = tickerPrices?.get(date) ?? 0;
        portfolioValue += shares * price;
      }

      const portfolioReturn = totalCostBasis > 0
        ? ((portfolioValue - totalCostBasis) / totalCostBasis) * 100
        : 0;

      const benchmarkPrice = benchmarkPrices.get(date) ?? firstBenchmarkPrice;
      const benchmarkReturn = firstBenchmarkPrice > 0
        ? ((benchmarkPrice - firstBenchmarkPrice) / firstBenchmarkPrice) * 100
        : 0;

      dataPoints.push({ date, portfolioReturn, benchmarkReturn });
    }

    const lastDataPoint = dataPoints[dataPoints.length - 1];

    return {
      range,
      benchmark,
      dataPoints,
      portfolioTotalReturn: lastDataPoint?.portfolioReturn ?? 0,
      benchmarkTotalReturn: lastDataPoint?.benchmarkReturn ?? 0,
    };
  }
}
