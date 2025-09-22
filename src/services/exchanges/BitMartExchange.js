const BaseExchange = require('./BaseExchange');

class BitMartExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitmart',
      baseURL: 'https://api-cloud.bitmart.com/spot/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 1000) {
        throw new Error(`BitMart API error: ${data.message}`);
      }

      let tickers = data.data.tickers;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bitmartSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitmartSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('_USDT') ||
        ticker.symbol.endsWith('_USDC') ||
        ticker.symbol.endsWith('_BTC') ||
        ticker.symbol.endsWith('_ETH') ||
        ticker.symbol.endsWith('_BMX')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`BitMart API error:`, error.message);
      throw new Error(`Failed to fetch tickers from BitMart: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const bitmartSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/symbols/book';
      const params = { symbol: bitmartSymbol, size: limit };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 1000) {
        throw new Error(`BitMart orderbook error: ${data.message}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.buys.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        asks: data.data.sells.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        timestamp: parseInt(data.data.ts)
      };
    } catch (error) {
      console.error(`BitMart order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTC_USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toUpperCase();
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}_USDT`;
    }

    if (symbol.includes('_')) {
      return symbol.toUpperCase();
    }

    return `${symbol}_USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_price);
    const change = parseFloat(ticker.fluctuation);
    const changePercent = change * 100;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.base_volume),
      high: parseFloat(ticker.high_price),
      low: parseFloat(ticker.low_price),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.best_bid || price),
      ask: parseFloat(ticker.best_ask || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitmartSymbol) {
    // BTC_USDT -> BTC/USDT
    return bitmartSymbol.replace('_', '/');
  }
}

module.exports = BitMartExchange;