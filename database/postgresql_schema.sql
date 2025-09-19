-- PostgreSQL Schema for Crypto Tracker
-- Stores coin metadata and exchange information

-- Coins table - Enhanced with multiple ID references
CREATE TABLE coins (
    id VARCHAR(50) PRIMARY KEY,  -- Our internal ID (usually coingecko_id)
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    coingecko_id VARCHAR(50) UNIQUE,
    coinmarketcap_id INTEGER UNIQUE,
    logo_url TEXT,
    description TEXT,
    website_url TEXT,
    whitepaper_url TEXT,
    market_cap_rank INTEGER,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exchanges table - Exchange information
CREATE TABLE exchanges (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_url TEXT NOT NULL,
    fee_rate DECIMAL(5,4) DEFAULT 0.001,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INTEGER DEFAULT 1200,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Symbol mapping table - Enhanced for comprehensive mapping
CREATE TABLE symbol_mappings (
    id SERIAL PRIMARY KEY,
    coin_id VARCHAR(50) REFERENCES coins(id),
    exchange_id VARCHAR(50) REFERENCES exchanges(id),
    exchange_symbol VARCHAR(30) NOT NULL,     -- BTCUSDT, KRW-BTC, etc.
    base_currency VARCHAR(10) NOT NULL,       -- BTC, ETH, etc.
    quote_currency VARCHAR(10) NOT NULL,      -- USDT, KRW, USD, etc.
    normalized_symbol VARCHAR(20),            -- BTC/USDT (standard format)
    symbol_type VARCHAR(10) DEFAULT 'spot',   -- spot, futures, etc.
    is_active BOOLEAN DEFAULT true,
    confidence_score DECIMAL(3,2) DEFAULT 1.0, -- Mapping confidence (0.0-1.0)
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exchange_id, exchange_symbol, symbol_type)
);

-- Cross-reference table for multiple data sources
CREATE TABLE coin_cross_references (
    id SERIAL PRIMARY KEY,
    coin_id VARCHAR(50) REFERENCES coins(id),
    source_name VARCHAR(30) NOT NULL,         -- 'coingecko', 'coinmarketcap', 'coinbase'
    source_id VARCHAR(50) NOT NULL,           -- External ID from that source
    source_symbol VARCHAR(20),                -- Symbol from that source
    is_primary BOOLEAN DEFAULT false,         -- Primary reference for this source
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_name, source_id)
);

-- Mapping update log
CREATE TABLE mapping_update_logs (
    id SERIAL PRIMARY KEY,
    update_type VARCHAR(20) NOT NULL,         -- 'full', 'incremental', 'manual'
    source VARCHAR(30) NOT NULL,              -- 'coingecko', 'coinmarketcap'
    records_processed INTEGER,
    records_updated INTEGER,
    records_inserted INTEGER,
    errors_count INTEGER DEFAULT 0,
    error_details TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running'      -- 'running', 'completed', 'failed'
);

-- Market pairs table - Trading pair information
CREATE TABLE market_pairs (
    id SERIAL PRIMARY KEY,
    exchange_id VARCHAR(50) REFERENCES exchanges(id),
    base_currency VARCHAR(10) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    min_trade_amount DECIMAL(20,8),
    min_price_increment DECIMAL(20,8),
    listing_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_coins_symbol ON coins(symbol);
CREATE INDEX idx_coins_market_cap_rank ON coins(market_cap_rank);
CREATE INDEX idx_coins_coingecko_id ON coins(coingecko_id);
CREATE INDEX idx_coins_coinmarketcap_id ON coins(coinmarketcap_id);

CREATE INDEX idx_symbol_mappings_exchange_symbol ON symbol_mappings(exchange_id, exchange_symbol);
CREATE INDEX idx_symbol_mappings_base_currency ON symbol_mappings(exchange_id, base_currency);
CREATE INDEX idx_symbol_mappings_coin_id ON symbol_mappings(coin_id);
CREATE INDEX idx_symbol_mappings_active ON symbol_mappings(exchange_id, is_active);

CREATE INDEX idx_cross_references_source ON coin_cross_references(source_name, source_id);
CREATE INDEX idx_cross_references_coin_id ON coin_cross_references(coin_id);

CREATE INDEX idx_market_pairs_symbol ON market_pairs(exchange_id, symbol);
CREATE INDEX idx_mapping_logs_status ON mapping_update_logs(status, started_at);

-- Insert initial exchange data
INSERT INTO exchanges (id, name, api_url, rate_limit_per_minute) VALUES
('binance', 'Binance', 'https://api.binance.com', 1200),
('upbit', 'Upbit', 'https://api.upbit.com/v1', 600),
('coinbase', 'Coinbase Pro', 'https://api.exchange.coinbase.com', 3000),
('bithumb', 'Bithumb', 'https://api.bithumb.com/public', 900),
('kucoin', 'KuCoin', 'https://api.kucoin.com/api/v1', 1800),
('okx', 'OKX', 'https://www.okx.com/api/v5', 1200);