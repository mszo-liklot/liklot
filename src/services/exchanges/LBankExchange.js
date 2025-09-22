const BaseExchange = require('./BaseExchange');

class LBankExchange extends BaseExchange {
  constructor() {
    super({
      name: 'lbank',
      baseURL: 'https://api.lbank.info/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker/24hr.do';
      const params = { symbol: 'all' };
      const data = await this.makeRequest(endpoint, params);

      if (!data.data) {
        throw new Error(`LBank API error: ${data.error_code || 'Unknown error'}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const lbankSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          lbankSymbols.includes(ticker.symbol)
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
      console.error(`LBank API error:`, error.message);
      throw new Error(`Failed to fetch tickers from LBank: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 200) {
    try {
      const lbankSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/depth.do';
      const params = { symbol: lbankSymbol, size: limit, merge: 0 };

      const data = await this.makeRequest(endpoint, params);

      if (!data.data) {
        throw new Error(`LBank orderbook error: ${data.error_code || 'Unknown error'}`);
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
      console.error(`LBank order book error:`, error.message);
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
    const price = parseFloat(ticker.ticker.latest);
    const change = parseFloat(ticker.ticker.change);
    const changePercent = parseFloat(ticker.ticker.changeRate) * 100;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.ticker.vol),
      high: parseFloat(ticker.ticker.high),
      low: parseFloat(ticker.ticker.low),
      change: change,
      changePercent: changePercent,
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(lbankSymbol) {
    // btc_usdt -> BTC/USDT
    return lbankSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = LBankExchange;