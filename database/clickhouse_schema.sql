-- ClickHouse Schema for Crypto Tracker
-- Stores time-series data (prices, VWAP, OHLCV)

-- OHLCV Data Table - Candlestick chart data
CREATE TABLE ohlcv (
    timestamp DateTime,
    symbol String,
    exchange String,
    interval String,  -- 1m, 5m, 15m, 30m, 1h, 4h, 1d
    open Float64,
    high Float64,
    low Float64,
    close Float64,
    volume Float64,
    quote_volume Float64,
    trade_count UInt32,
    source String DEFAULT 'api'  -- 'api', 'tradingview', 'calculated'
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, interval, timestamp);

-- VWAP Data Table - Volume Weighted Average Price
CREATE TABLE vwap_data (
    timestamp DateTime,
    symbol String,
    time_window String,  -- 5s, 1m, 5m, 15m, 1h, 4h, 24h
    vwap_price Float64,
    total_volume Float64,
    total_value Float64,
    exchange_count UInt8,
    participating_exchanges Array(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, time_window, timestamp);

-- Real-time Price Data Table - Raw price data from exchanges
CREATE TABLE real_time_prices (
    timestamp DateTime,
    symbol String,
    exchange String,
    price Float64,
    volume Float64,
    bid_price Float64,
    ask_price Float64,
    spread Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 7 DAY;  -- Auto-delete after 7 days

-- Historical Data Table - Data from TradingView
CREATE TABLE historical_data (
    timestamp DateTime,
    symbol String,
    source String,  -- 'tradingview'
    interval String,
    open Float64,
    high Float64,
    low Float64,
    close Float64,
    volume Float64
) ENGINE = MergeTree()
PARTITION BY toYYYY(timestamp)
ORDER BY (symbol, interval, timestamp);

-- Exchange Rate Data - For USD conversion
CREATE TABLE exchange_rates (
    timestamp DateTime,
    from_currency String,
    to_currency String,
    rate Float64
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (from_currency, to_currency, timestamp);

-- Materialized View for 24h statistics
CREATE MATERIALIZED VIEW mv_24h_stats
ENGINE = ReplacingMergeTree()
ORDER BY (symbol, timestamp)
AS SELECT
    symbol,
    toStartOfHour(timestamp) as timestamp,
    argMax(close, timestamp) as current_price,
    min(low) as low_24h,
    max(high) as high_24h,
    sum(volume) as volume_24h,
    (argMax(close, timestamp) - argMin(close, timestamp)) / argMin(close, timestamp) * 100 as change_24h_percent
FROM ohlcv
WHERE timestamp >= now() - INTERVAL 24 HOUR
    AND interval = '1h'
GROUP BY symbol, toStartOfHour(timestamp);

-- Indexes for better performance
-- ClickHouse automatically creates indexes based on ORDER BY