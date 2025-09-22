const BaseExchange = require('./BaseExchange');

class NovaDAXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'novadax',
      baseURL: 'https://api.novadax.com/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/market/tickers';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 'A10000') {
        throw new Error(`NovaDAX API error: ${data.message}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const novadaxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          novadaxSymbols.includes(ticker.symbol)
        );
      }

      // Filter for BRL (Brazilian Real) and major stablecoin pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('_BRL') ||
        ticker.symbol.endsWith('_USDT') ||
        ticker.symbol.endsWith('_BTC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`NovaDAX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from NovaDAX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const novadaxSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/market/depth';
      const params = { symbol: novadaxSymbol, limit };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 'A10000') {
        throw new Error(`NovaDAX orderbook error: ${data.message}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: parseInt(data.data.timestamp)
      };
    } catch (error) {
      console.error(`NovaDAX order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/BRL -> BTC_BRL
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toUpperCase();
    } else if (symbol.endsWith('BRL')) {
      const base = symbol.replace('BRL', '');
      return `${base}_BRL`;
    }

    if (symbol.includes('_')) {
      return symbol.toUpperCase();
    }

    return `${symbol}_BRL`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.changePercent);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high24h),
      low: parseFloat(ticker.low24h),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.bidPrice || price),
      ask: parseFloat(ticker.askPrice || price),
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(novadaxSymbol) {
    // BTC_BRL -> BTC/BRL
    return novadaxSymbol.replace('_', '/');
  }
}

module.exports = NovaDAXExchange;