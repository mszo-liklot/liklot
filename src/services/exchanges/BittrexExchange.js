const BaseExchange = require('./BaseExchange');

class BittrexExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bittrex',
      baseURL: 'https://api.bittrex.com/v3',
      rateLimit: 167 // 167ms between requests (360/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/markets/tickers';
      const data = await this.makeRequest(endpoint);

      let tickers = data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bittrexSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bittrexSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('-USDT') ||
        ticker.symbol.endsWith('-USD') ||
        ticker.symbol.endsWith('-BTC') ||
        ticker.symbol.endsWith('-ETH')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bittrex API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bittrex: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 25) {
    try {
      const bittrexSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/markets/${bittrexSymbol}/orderbook`;
      const params = { depth: limit };

      const data = await this.makeRequest(endpoint, params);

      return {
        symbol,
        exchange: this.name,
        bids: data.bid.map(order => ({
          price: parseFloat(order.rate),
          quantity: parseFloat(order.quantity)
        })),
        asks: data.ask.map(order => ({
          price: parseFloat(order.rate),
          quantity: parseFloat(order.quantity)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Bittrex order book error:`, error.message);
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
    const price = parseFloat(ticker.lastTradeRate);
    const change = parseFloat(ticker.percentChange);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      changePercent: change,
      bid: parseFloat(ticker.bidRate || price),
      ask: parseFloat(ticker.askRate || price),
      timestamp: new Date(ticker.updatedAt).getTime(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bittrexSymbol) {
    // BTC-USDT -> BTC/USDT
    return bittrexSymbol.replace('-', '/');
  }
}

module.exports = BittrexExchange;