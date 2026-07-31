import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { StockNews } from '../../types';
import { InMemoryCache } from '../../cache/in-memory-cache';

export interface AnalysisResult {
  summary: string;
  provider: 'OpenAI' | 'Gemini' | 'None';
}

export class AiAnalyzerService {
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;
  
  private readonly GEMINI_MODEL = 'gemini-2.5-flash';
  private readonly OPENAI_MODEL = 'gpt-4o-mini';

  constructor(private readonly cache: InMemoryCache) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    const oldAiKey = process.env.AI_API_KEY; // Support the one user added earlier

    if (openAiKey) {
      this.openai = new OpenAI({ apiKey: openAiKey });
    }
    
    // Fallback to AI_API_KEY if GEMINI_API_KEY is not set but AI_API_KEY is
    if (geminiKey || oldAiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiKey || oldAiKey });
    }

    if (!this.openai && !this.gemini) {
      console.warn('Neither OPENAI_API_KEY nor GEMINI_API_KEY is set. AI Analysis will be disabled.');
    }
  }

  async analyzeNews(ticker: string, news: StockNews[]): Promise<AnalysisResult> {
    if (!news || news.length === 0) {
      return { summary: 'No recent news available to analyze.', provider: 'None' };
    }

    const cacheKey = `ai_analysis_dual:${ticker}`;
    const cached = this.cache.get<AnalysisResult>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.openai && !this.gemini) {
      return { 
        summary: 'AI Analysis is currently disabled. Please configure OPENAI_API_KEY or GEMINI_API_KEY in your environment.',
        provider: 'None'
      };
    }

    const headlines = news.map(n => `- ${n.title} (by ${n.publisher})`).join('\n');
    const prompt = `You are an expert financial analyst. Please analyze the following recent news headlines for the stock ticker ${ticker}. 
Summarize the overall sentiment (Positive, Negative, or Neutral) and highlight 1-2 key takeaways or events to watch out for. Keep your response concise (3-4 sentences maximum).
Write the response in Thai.

News Headlines:
${headlines}`;

    try {
      let analysis = '';
      let provider: 'OpenAI' | 'Gemini' = 'None' as any;

      // Prefer OpenAI if available, otherwise use Gemini
      if (this.openai) {
        provider = 'OpenAI';
        const response = await this.openai.chat.completions.create({
          model: this.OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
        });
        analysis = response.choices[0]?.message?.content || 'Unable to generate analysis at this time.';
      } else if (this.gemini) {
        provider = 'Gemini';
        const response = await this.gemini.models.generateContent({
          model: this.GEMINI_MODEL,
          contents: prompt,
        });
        analysis = response.text || 'Unable to generate analysis at this time.';
      }

      const result: AnalysisResult = { summary: analysis, provider };
      
      // Cache the analysis for 1 hour
      this.cache.set(cacheKey, result, 60 * 60 * 1000);
      return result;
    } catch (err) {
      console.error(`Error analyzing news for ${ticker}:`, err);
      return { 
        summary: 'An error occurred while analyzing the news. Please try again later.',
        provider: 'None'
      };
    }
  }
}

