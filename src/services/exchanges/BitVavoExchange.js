const BaseExchange = require('./BaseExchange');

class BitVavoExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitvavo',
      baseURL: 'https://api.bitvavo.com/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker/24h';
      const data = await this.makeRequest(endpoint);

      let tickers = data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bitvavoSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitvavoSymbols.includes(ticker.market)
        );
      }

      // Filter for EUR and major stablecoin pairs
      tickers = tickers.filter(ticker =>
        ticker.market.endsWith('-EUR') ||
        ticker.market.endsWith('-USDT') ||
        ticker.market.endsWith('-BTC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitvavo API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitvavo: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 500) {
    try {
      const bitvavoSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/${bitvavoSymbol}/book?depth=${limit}`;

      const data = await this.makeRequest(endpoint);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.map(([price, size]) => ({
          price: parseFloat(price),
          quantity: parseFloat(size)
        })),
        asks: data.asks.map(([price, size]) => ({
          price: parseFloat(price),
          quantity: parseFloat(size)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Bitvavo order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/EUR -> BTC-EUR
    if (symbol.includes('/')) {
      return symbol.replace('/', '-').toUpperCase();
    } else if (symbol.endsWith('EUR')) {
      const base = symbol.replace('EUR', '');
      return `${base}-EUR`;
    }

    if (symbol.includes('-')) {
      return symbol.toUpperCase();
    }

    return `${symbol}-EUR`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.market),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitvavoSymbol) {
    // BTC-EUR -> BTC/EUR
    return bitvavoSymbol.replace('-', '/');
  }
}

module.exports = BitVavoExchange;