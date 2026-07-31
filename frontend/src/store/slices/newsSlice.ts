import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface StockNews {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  type: string;
}

export interface NewsAnalysisResult {
  ticker: string;
  articles: StockNews[];
  aiSummary: string;
  aiProvider?: 'OpenAI' | 'Gemini' | 'None';
}

interface NewsState {
  data: Record<string, NewsAnalysisResult>;
  loading: boolean;
  error: string | null;
}

const initialState: NewsState = {
  data: {},
  loading: false,
  error: null,
};

export const fetchNewsAndInsights = createAsyncThunk(
  'news/fetchNewsAndInsights',
  async (ticker: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`http://localhost:3001/api/news/${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch news and insights');
      }
      const data = await response.json();
      return data as NewsAnalysisResult;
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred while fetching news');
    }
  }
);

const newsSlice = createSlice({
  name: 'news',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNewsAndInsights.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNewsAndInsights.fulfilled, (state, action) => {
        state.loading = false;
        state.data[action.payload.ticker] = action.payload;
      })
      .addCase(fetchNewsAndInsights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default newsSlice.reducer;
