import { Router, Request, Response } from 'express';
import { NewsService } from './news.service';
import { AiAnalyzerService } from './ai-analyzer.service';
import { appCache } from '../../cache/in-memory-cache';

const defaultNewsService = new NewsService(appCache);
const defaultAiAnalyzer = new AiAnalyzerService(appCache);

export interface NewsRouterDeps {
  newsService?: NewsService;
  aiAnalyzer?: AiAnalyzerService;
}

export function createNewsRouter(deps?: NewsRouterDeps): Router {
  const newsService = deps?.newsService ?? defaultNewsService;
  const aiAnalyzer = deps?.aiAnalyzer ?? defaultAiAnalyzer;
  const router = Router();

  /**
   * GET /api/news/:ticker
   * Returns recent news for a ticker along with an AI-generated summary.
   */
  router.get('/:ticker', async (req: Request, res: Response) => {
    try {
      const ticker = String(req.params.ticker).toUpperCase();
      
      const articles = await newsService.fetchNews(ticker);
      
      const analysisResult = await aiAnalyzer.analyzeNews(ticker, articles);

      res.status(200).json({
        ticker,
        articles,
        aiSummary: analysisResult.summary,
        aiProvider: analysisResult.provider,
      });
    } catch (err) {
      console.error('Error in news route:', err);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while fetching news and analysis.',
        retryable: true
      });
    }
  });

  return router;
}

export default createNewsRouter();
