const BaseExchange = require('./BaseExchange');

class BitsoExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitso',
      baseURL: 'https://api.bitso.com/v3',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (!data.success) {
        throw new Error(`Bitso API error: ${data.error?.message}`);
      }

      let tickers = data.payload;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bitsoSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitsoSymbols.includes(ticker.book)
        );
      }

      // Filter for MXN (Mexican Peso), USD, and BTC pairs
      tickers = tickers.filter(ticker =>
        ticker.book.endsWith('_mxn') ||
        ticker.book.endsWith('_usd') ||
        ticker.book.endsWith('_btc')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitso API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitso: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const bitsoSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/order_book/?book=${bitsoSymbol}`;

      const data = await this.makeRequest(endpoint);

      if (!data.success) {
        throw new Error(`Bitso orderbook error: ${data.error?.message}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.payload.bids.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        asks: data.payload.asks.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        timestamp: new Date(data.payload.updated_at).getTime()
      };
    } catch (error) {
      console.error(`Bitso order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/MXN -> btc_mxn
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toLowerCase();
    } else if (symbol.endsWith('MXN')) {
      const base = symbol.replace('MXN', '');
      return `${base}_mxn`.toLowerCase();
    } else if (symbol.endsWith('USD')) {
      const base = symbol.replace('USD', '');
      return `${base}_usd`.toLowerCase();
    }
    return (symbol + '_mxn').toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.change_24);

    return {
      symbol: this.denormalizeSymbol(ticker.book),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: new Date(ticker.created_at).getTime(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitsoSymbol) {
    // btc_mxn -> BTC/MXN
    return bitsoSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = BitsoExchange;