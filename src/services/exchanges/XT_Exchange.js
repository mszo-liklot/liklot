const BaseExchange = require('./BaseExchange');

class XT_Exchange extends BaseExchange {
  constructor() {
    super({
      name: 'xt',
      baseURL: 'https://api.xt.com/data/api/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/getTickers';
      const data = await this.makeRequest(endpoint);

      if (!data.result) {
        throw new Error(`XT API error: ${data.message || 'Unknown error'}`);
      }

      let tickers = Object.entries(data.result).map(([symbol, ticker]) => ({
        ...ticker,
        symbol: symbol
      }));

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const xtSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          xtSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('_usdt') ||
        ticker.symbol.endsWith('_usdc') ||
        ticker.symbol.endsWith('_btc') ||
        ticker.symbol.endsWith('_eth')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`XT API error:`, error.message);
      throw new Error(`Failed to fetch tickers from XT: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const xtSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/getDepth';
      const params = { symbol: xtSymbol, size: limit };

      const data = await this.makeRequest(endpoint, params);

      if (!data.result) {
        throw new Error(`XT orderbook error: ${data.message || 'Unknown error'}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.result.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.result.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: data.result.timestamp
      };
    } catch (error) {
      console.error(`XT order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> btc_usdt
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toLowerCase();
    }
    return symbol.toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.c);
    const open = parseFloat(ticker.o);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.v),
      high: parseFloat(ticker.h),
      low: parseFloat(ticker.l),
      change: change,
      changePercent: changePercent,
      open: open,
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(xtSymbol) {
    // btc_usdt -> BTC/USDT
    return xtSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = XT_Exchange;