# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run init` - Initialize project setup (run init.js)

### Testing
- `npm test` - Run Jest tests
- `npm run test:mapping` - Test symbol mapping system
- `npm run test:exchanges` - Test exchange integrations
- `npm run test:strategy` - Test ETL improvement strategy
- `npm run test:all` - Run all custom tests (mapping + exchanges + strategy)
- `npm run check` - Run all tests + health check

### Database Operations
- `npm run db:schema` - Display PostgreSQL schema setup command
- Database schemas located in `database/postgresql_schema.sql` and `database/clickhouse_schema.sql`

### System Status
- `npm run health` - Check if server is running (curl localhost:3000/health)
- `npm run exchanges` - List active exchanges via ExchangeManager
- `npm run structure` - Display project file structure

## Architecture Overview

**Liklot** is a cryptocurrency market data platform that aggregates real-time price data from 11 major exchanges and calculates Volume Weighted Average Prices (VWAP).

### Core Components

**Exchange Layer** (`src/services/exchanges/`)
- 11 exchange implementations extending `BaseExchange.js`
- Supported: Binance, Upbit, Coinbase, Bithumb, KuCoin, OKX, Bybit, Gate.io, Huobi, Kraken, MEXC
- Each exchange handles rate limiting and symbol mapping

**Data Processing** (`src/services/`)
- `ExchangeManager.js` - Orchestrates all 11 exchanges, provides parallel ticker fetching and VWAP calculation
- `ETLPipeline.js` - Parallel data extraction/transformation/loading with 75% performance improvement
- `SymbolMappingService.js` - 90%+ accuracy cryptocurrency symbol standardization using CoinGecko/CoinMarketCap APIs

**Scheduling** (`src/schedulers/`)
- `MappingUpdateScheduler.js` - Automated symbol mapping updates and VWAP calculations

### Data Flow
1. **Parallel Data Collection** - All 11 exchanges fetched simultaneously (~5 seconds)
2. **Symbol Mapping** - Exchange-specific symbols mapped to standard IDs
3. **VWAP Calculation** - Volume-weighted prices calculated across exchanges
4. **OHLCV Generation** - Candlestick data generated from VWAP (1m, 5m, 15m, 1h, 4h, 1d)
5. **Storage** - PostgreSQL (metadata), ClickHouse (time-series), Redis (cache)

### Database Architecture

**PostgreSQL** (Metadata)
- `coins` - Cryptocurrency information
- `exchanges` - Exchange configurations
- `symbol_mappings` - Exchange symbol to standard ID mappings
- `coin_cross_references` - Multi-source ID references

**ClickHouse** (Time-series)
- `real_time_prices` - Raw exchange price data
- `vwap_data` - Calculated VWAP values
- `ohlcv` - Candlestick chart data

**Redis** (Cache)
- Real-time price caching and market data aggregation

## Environment Setup

**Required API Keys:**
- `COINMARKETCAP_API_KEY` - Required for symbol mapping (get free key at coinmarketcap.com/api/)
- `COINGECKO_API_KEY` - Optional pro key for enhanced symbol mapping

**Database URLs:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `CLICKHOUSE_URL` - ClickHouse connection string

**Exchange API Keys:** Optional for public endpoints, required for private trading functions

## Performance Characteristics

**Before Parallel Processing:**
- Data Collection: 30 seconds (sequential)
- Total Pipeline: ~45 seconds

**After Parallel Processing:**
- Data Collection: 5 seconds (83% faster)
- Total Pipeline: ~12 seconds (75% improvement)

**Symbol Mapping:** 90%+ accuracy across 192+ symbol mappings for 8 major cryptocurrencies

## Testing Strategy

The project uses custom test files rather than traditional unit tests:
- `tests/mapping-verification.js` - Validates symbol mapping accuracy and CoinGecko API integration
- `tests/exchange-integration.js` - Tests all 11 exchange connections and rate limits
- `tests/improvement-strategy.js` - Measures ETL pipeline performance improvements

Always run `npm run test:all` to verify system integrity after changes.

## Rate Limiting

Each exchange has specific rate limits (avg 1115 requests/min across all exchanges). The ExchangeManager handles rate limiting automatically and provides parallel processing to maximize throughput while respecting limits.