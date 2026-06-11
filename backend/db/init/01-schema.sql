CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    ticker_symbol VARCHAR(20) NOT NULL,
    transaction_date VARCHAR(50) NOT NULL,
    price_per_share NUMERIC(10, 4) NOT NULL,
    shares NUMERIC(10, 4) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    source VARCHAR(20) NOT NULL,
    slip_image_url TEXT,
    ocr_raw_text TEXT,
    created_at VARCHAR(50) NOT NULL,
    updated_at VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlists (
    user_id VARCHAR(50) NOT NULL,
    ticker_symbol VARCHAR(20) NOT NULL,
    added_at VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, ticker_symbol)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_pair VARCHAR(20) PRIMARY KEY,
    rate NUMERIC(15, 6) NOT NULL,
    fetched_at VARCHAR(50) NOT NULL
);
