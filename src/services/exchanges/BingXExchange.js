const BaseExchange = require('./BaseExchange');

class BingXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bingx',
      baseURL: 'https://open-api.bingx.com/openApi/spot/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker/24hr';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 0) {
        throw new Error(`BingX API error: ${data.msg}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bingxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bingxSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('-USDT') ||
        ticker.symbol.endsWith('-USDC') ||
        ticker.symbol.endsWith('-BTC') ||
        ticker.symbol.endsWith('-ETH')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`BingX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from BingX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const bingxSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/depth';
      const params = { symbol: bingxSymbol, limit };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`BingX orderbook error: ${data.msg}`);
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
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`BingX order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTC-USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '-').toUpperCase();
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}-USDT`;
    }

    if (symbol.includes('-')) {
      return symbol.toUpperCase();
    }

    return `${symbol}-USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChange);
    const changePercent = parseFloat(ticker.priceChangePercent);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice),
      change: change,
      changePercent: changePercent,
      open: parseFloat(ticker.openPrice),
      bid: parseFloat(ticker.bidPrice || price),
      ask: parseFloat(ticker.askPrice || price),
      timestamp: parseInt(ticker.closeTime),
      exchange: this.name
    };
  }

  denormalizeSymbol(bingxSymbol) {
    // BTC-USDT -> BTC/USDT
    return bingxSymbol.replace('-', '/');
  }
}

module.exports = BingXExchange;