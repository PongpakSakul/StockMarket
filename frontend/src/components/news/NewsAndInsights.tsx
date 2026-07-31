import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchNewsAndInsights } from '../../store/slices/newsSlice';

interface NewsAndInsightsProps {
  ticker: string;
}

export const NewsAndInsights: React.FC<NewsAndInsightsProps> = ({ ticker }) => {
  const dispatch = useAppDispatch();
  const newsData = useAppSelector((state) => state.news.data[ticker]);
  const loading = useAppSelector((state) => state.news.loading);
  const error = useAppSelector((state) => state.news.error);

  useEffect(() => {
    if (ticker && !newsData && !loading) {
      dispatch(fetchNewsAndInsights(ticker));
    }
  }, [ticker, dispatch, newsData, loading]);

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-slate-900 rounded-2xl border border-slate-800 animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mb-4"></div>
        <div className="h-24 bg-slate-800 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-6 bg-red-900/20 text-red-400 rounded-2xl border border-red-900/50">
        <h3 className="text-lg font-semibold mb-2">Error Loading News</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!newsData) {
    return null;
  }

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">News & AI Insights</h2>
      
      {/* AI Insights Section */}
      <div className="p-6 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-2xl border border-indigo-500/30 relative overflow-hidden shadow-lg shadow-indigo-500/10">
        <div className="absolute top-0 right-0 p-4 opacity-20">
          <svg className="w-16 h-16 text-indigo-400 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-indigo-300 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          AI Analysis ({newsData.aiProvider && newsData.aiProvider !== 'None' ? newsData.aiProvider : 'Gemini'})
        </h3>
        <p className="text-slate-300 leading-relaxed whitespace-pre-line z-10 relative">
          {newsData.aiSummary}
        </p>
      </div>

      {/* Actual News Articles Section */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Headlines</h3>
        {newsData.articles.length > 0 ? (
          <div className="space-y-4">
            {newsData.articles.map((article) => {
              const date = new Date(article.providerPublishTime * 1000).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
              });
              return (
                <a 
                  key={article.uuid} 
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors border border-slate-700/50 hover:border-slate-600 group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded">
                      {article.publisher}
                    </span>
                    <span className="text-xs text-slate-500">{date}</span>
                  </div>
                  <h4 className="text-slate-200 font-medium group-hover:text-white transition-colors line-clamp-2">
                    {article.title}
                  </h4>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 italic">No recent news found for this ticker.</p>
        )}
      </div>
    </div>
  );
};
