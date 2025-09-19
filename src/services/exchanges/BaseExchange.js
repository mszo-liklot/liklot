const axios = require('axios');

class BaseExchange {
  constructor(config) {
    this.name = config.name;
    this.baseURL = config.baseURL;
    this.rateLimit = config.rateLimit || 1000; // ms between requests
    this.lastRequestTime = 0;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });
  }

  // Rate limiting
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  // Abstract methods to be implemented by each exchange
  async getTickers(symbols) {
    throw new Error('getTickers method must be implemented');
  }

  async getOrderBook(symbol) {
    throw new Error('getOrderBook method must be implemented');
  }

  async getKlines(symbol, interval, limit = 1000) {
    throw new Error('getKlines method must be implemented');
  }

  // Normalize symbol format (e.g., BTC/USDT -> BTCUSDT for Binance)
  normalizeSymbol(symbol) {
    return symbol;
  }

  // Standardize ticker format
  standardizeTicker(rawTicker) {
    return {
      symbol: rawTicker.symbol,
      price: parseFloat(rawTicker.price || rawTicker.last),
      volume: parseFloat(rawTicker.volume || rawTicker.baseVolume),
      high: parseFloat(rawTicker.high || rawTicker.high24hr),
      low: parseFloat(rawTicker.low || rawTicker.low24hr),
      change: parseFloat(rawTicker.change || rawTicker.priceChange),
      changePercent: parseFloat(rawTicker.changePercent || rawTicker.priceChangePercent),
      timestamp: Date.now(),
      exchange: this.name
    };
  }
}

module.exports = BaseExchange;