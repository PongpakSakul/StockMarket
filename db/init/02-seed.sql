-- ===========================================
-- Seed data: Common US stocks and ETFs
-- ===========================================

INSERT INTO tickers (symbol, name, type, exchange, is_active) VALUES
    -- Popular ETFs
    ('VOO',  'Vanguard S&P 500 ETF',                    'etf',   'NYSE',   TRUE),
    ('QQQM', 'Invesco NASDAQ 100 ETF',                  'etf',   'NASDAQ', TRUE),
    ('QQQ',  'Invesco QQQ Trust',                        'etf',   'NASDAQ', TRUE),
    ('VTI',  'Vanguard Total Stock Market ETF',          'etf',   'NYSE',   TRUE),
    ('SPY',  'SPDR S&P 500 ETF Trust',                   'etf',   'NYSE',   TRUE),
    ('IVV',  'iShares Core S&P 500 ETF',                 'etf',   'NYSE',   TRUE),
    ('VGT',  'Vanguard Information Technology ETF',      'etf',   'NYSE',   TRUE),
    ('SCHD', 'Schwab U.S. Dividend Equity ETF',          'etf',   'NYSE',   TRUE),
    ('VT',   'Vanguard Total World Stock ETF',           'etf',   'NYSE',   TRUE),
    ('ARKK', 'ARK Innovation ETF',                       'etf',   'NYSE',   TRUE),

    -- Popular US Stocks
    ('AAPL', 'Apple Inc.',                               'stock', 'NASDAQ', TRUE),
    ('MSFT', 'Microsoft Corporation',                    'stock', 'NASDAQ', TRUE),
    ('GOOGL','Alphabet Inc. Class A',                    'stock', 'NASDAQ', TRUE),
    ('AMZN', 'Amazon.com Inc.',                          'stock', 'NASDAQ', TRUE),
    ('NVDA', 'NVIDIA Corporation',                       'stock', 'NASDAQ', TRUE),
    ('META', 'Meta Platforms Inc.',                      'stock', 'NASDAQ', TRUE),
    ('TSLA', 'Tesla Inc.',                               'stock', 'NASDAQ', TRUE),
    ('BRK.B','Berkshire Hathaway Inc. Class B',          'stock', 'NYSE',   TRUE),
    ('JPM',  'JPMorgan Chase & Co.',                     'stock', 'NYSE',   TRUE),
    ('V',    'Visa Inc.',                                'stock', 'NYSE',   TRUE),
    ('JNJ',  'Johnson & Johnson',                        'stock', 'NYSE',   TRUE),
    ('WMT',  'Walmart Inc.',                             'stock', 'NYSE',   TRUE),
    ('PG',   'Procter & Gamble Co.',                     'stock', 'NYSE',   TRUE),
    ('MA',   'Mastercard Inc.',                          'stock', 'NYSE',   TRUE),
    ('DIS',  'The Walt Disney Company',                  'stock', 'NYSE',   TRUE),
    ('NFLX', 'Netflix Inc.',                             'stock', 'NASDAQ', TRUE),
    ('AMD',  'Advanced Micro Devices Inc.',              'stock', 'NASDAQ', TRUE),
    ('INTC', 'Intel Corporation',                        'stock', 'NASDAQ', TRUE),
    ('CRM',  'Salesforce Inc.',                          'stock', 'NYSE',   TRUE),
    ('COST', 'Costco Wholesale Corporation',             'stock', 'NASDAQ', TRUE)
ON CONFLICT (symbol) DO NOTHING;
