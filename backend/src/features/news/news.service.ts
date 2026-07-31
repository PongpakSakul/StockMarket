import YahooFinanceType from 'yahoo-finance2';
const yahooFinance = new (YahooFinanceType as any)();
import { StockNews } from '../../types';
import { InMemoryCache } from '../../cache/in-memory-cache';

export class NewsService {
  constructor(private readonly cache: InMemoryCache) {}

  async fetchNews(ticker: string): Promise<StockNews[]> {
    const cacheKey = `news:${ticker}`;
    const cached = this.cache.get<StockNews[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const results: any = await yahooFinance.search(ticker, { newsCount: 10 });
      if (!results || !results.news) return [];

      const news: StockNews[] = results.news.map((n: any) => ({
        uuid: n.uuid,
        title: n.title,
        publisher: n.publisher,
        link: n.link,
        providerPublishTime: n.providerPublishTime,
        type: n.type,
      }));

      // Cache for 15 minutes
      this.cache.set(cacheKey, news, 15 * 60 * 1000);
      return news;
    } catch (err) {
      console.error(`Error fetching news for ${ticker}:`, err);
      return [];
    }
  }
}
