-- ===========================================
-- Stock Portfolio Tracker - Database Initialization
-- ===========================================
-- This script runs automatically when the PostgreSQL container starts
-- for the first time (via /docker-entrypoint-initdb.d/).

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tickers table
CREATE TABLE IF NOT EXISTS tickers (
    symbol VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('stock', 'etf')),
    exchange VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_price_update TIMESTAMP WITH TIME ZONE
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL REFERENCES tickers(symbol),
    transaction_date DATE NOT NULL,
    price_per_share DECIMAL(10, 2) NOT NULL CHECK (price_per_share > 0),
    shares DECIMAL(16, 6) NOT NULL CHECK (shares > 0),
    total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'dime_import')),
    slip_image_url VARCHAR(500),
    ocr_raw_text JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dividends table
CREATE TABLE IF NOT EXISTS dividends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL REFERENCES tickers(symbol),
    dividend_date DATE NOT NULL,
    amount_per_share DECIMAL(10, 6) NOT NULL CHECK (amount_per_share > 0),
    total_amount DECIMAL(14, 2) NOT NULL CHECK (total_amount > 0),
    shares_held DECIMAL(16, 6) NOT NULL CHECK (shares_held > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist items table
CREATE TABLE IF NOT EXISTS watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker_symbol VARCHAR(10) NOT NULL REFERENCES tickers(symbol),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, ticker_symbol)
);

-- Exchange rate cache table
CREATE TABLE IF NOT EXISTS exchange_rate_cache (
    currency_pair VARCHAR(10) PRIMARY KEY,
    rate DECIMAL(10, 4) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Price cache table
CREATE TABLE IF NOT EXISTS price_cache (
    ticker_symbol VARCHAR(10) NOT NULL REFERENCES tickers(symbol),
    price_date DATE NOT NULL,
    open DECIMAL(10, 2),
    high DECIMAL(10, 2),
    low DECIMAL(10, 2),
    close DECIMAL(10, 2),
    volume BIGINT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (ticker_symbol, price_date)
);

-- ===========================================
-- Indexes (per design doc)
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_ticker_date
    ON transactions(user_id, ticker_symbol, transaction_date);

CREATE INDEX IF NOT EXISTS idx_dividends_user_ticker
    ON dividends(user_id, ticker_symbol);

CREATE INDEX IF NOT EXISTS idx_watchlist_user
    ON watchlist_items(user_id);

CREATE INDEX IF NOT EXISTS idx_price_cache_ticker_date
    ON price_cache(ticker_symbol, price_date);
