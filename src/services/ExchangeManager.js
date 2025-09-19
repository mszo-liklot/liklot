const BinanceExchange = require('./exchanges/BinanceExchange');

class ExchangeManager {
  constructor() {
    this.exchanges = new Map();
    this.initialize();
  }

  initialize() {
    // Initialize exchanges
    this.exchanges.set('binance', new BinanceExchange());

    // TODO: Add other exchanges
    // this.exchanges.set('upbit', new UpbitExchange());
    // this.exchanges.set('coinbase', new CoinbaseExchange());

    console.log(`📊 Initialized ${this.exchanges.size} exchanges`);
  }

  // Get all active exchanges
  getActiveExchanges() {
    return Array.from(this.exchanges.keys());
  }

  // Get specific exchange
  getExchange(name) {
    return this.exchanges.get(name);
  }

  // Fetch tickers from all exchanges
  async fetchAllTickers(symbols = []) {
    const results = new Map();
    const promises = [];

    for (const [exchangeName, exchange] of this.exchanges) {
      promises.push(
        exchange.getTickers(symbols)
          .then(tickers => {
            results.set(exchangeName, tickers);
            console.log(`✅ ${exchangeName}: ${tickers.length} tickers fetched`);
          })
          .catch(error => {
            console.error(`❌ ${exchangeName} failed:`, error.message);
            results.set(exchangeName, []);
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  // Fetch specific symbol from all exchanges
  async fetchSymbolFromAllExchanges(symbol) {
    const results = [];
    const promises = [];

    for (const [exchangeName, exchange] of this.exchanges) {
      promises.push(
        exchange.getTickers([symbol])
          .then(tickers => {
            if (tickers.length > 0) {
              results.push(tickers[0]);
            }
          })
          .catch(error => {
            console.error(`❌ ${exchangeName} failed for ${symbol}:`, error.message);
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  // Calculate Volume Weighted Average Price (VWAP)
  calculateVWAP(tickers) {
    if (!tickers || tickers.length === 0) {
      return null;
    }

    let totalValue = 0;
    let totalVolume = 0;

    for (const ticker of tickers) {
      if (ticker.price && ticker.volume && ticker.volume > 0) {
        totalValue += ticker.price * ticker.volume;
        totalVolume += ticker.volume;
      }
    }

    if (totalVolume === 0) {
      return null;
    }

    return {
      vwap: totalValue / totalVolume,
      totalVolume,
      totalValue,
      exchangeCount: tickers.length,
      exchanges: tickers.map(t => t.exchange),
      timestamp: Date.now()
    };
  }

  // Get VWAP for a specific symbol
  async getSymbolVWAP(symbol) {
    const tickers = await this.fetchSymbolFromAllExchanges(symbol);
    return this.calculateVWAP(tickers);
  }

  // Health check for all exchanges
  async healthCheck() {
    const health = {};

    for (const [exchangeName, exchange] of this.exchanges) {
      try {
        const startTime = Date.now();
        await exchange.getTickers(['BTCUSDT']); // Test with BTC
        const responseTime = Date.now() - startTime;

        health[exchangeName] = {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        health[exchangeName] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }

    return health;
  }
}

module.exports = ExchangeManager;