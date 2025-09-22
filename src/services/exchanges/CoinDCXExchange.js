const BaseExchange = require('./BaseExchange');

class CoinDCXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'coindcx',
      baseURL: 'https://api.coindcx.com',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/exchange/ticker';
      const data = await this.makeRequest(endpoint);

      let tickers = data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const coindcxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          coindcxSymbols.includes(ticker.market)
        );
      }

      // Filter for major trading pairs (INR, USDT, BTC)
      tickers = tickers.filter(ticker =>
        ticker.market.endsWith('INR') ||
        ticker.market.endsWith('USDT') ||
        ticker.market.endsWith('BTC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`CoinDCX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from CoinDCX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const coindcxSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/exchange/v1/books/trades';
      const params = { pair: coindcxSymbol, limit };

      const data = await this.makeRequest(endpoint, params);

      // CoinDCX doesn't provide direct orderbook, using trade data as approximation
      return {
        symbol,
        exchange: this.name,
        bids: data.slice(0, Math.floor(limit/2)).map(trade => ({
          price: parseFloat(trade.p),
          quantity: parseFloat(trade.q)
        })),
        asks: data.slice(Math.floor(limit/2)).map(trade => ({
          price: parseFloat(trade.p),
          quantity: parseFloat(trade.q)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`CoinDCX order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/INR -> BTCINR
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_price);
    const change = parseFloat(ticker.change_24_hour);

    return {
      symbol: this.denormalizeSymbol(ticker.market),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: parseFloat(ticker.change_24_hour),
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(coindcxSymbol) {
    // BTCINR -> BTC/INR
    if (coindcxSymbol.endsWith('INR')) {
      return coindcxSymbol.replace('INR', '') + '/INR';
    } else if (coindcxSymbol.endsWith('USDT')) {
      return coindcxSymbol.replace('USDT', '') + '/USDT';
    } else if (coindcxSymbol.endsWith('BTC')) {
      return coindcxSymbol.replace('BTC', '') + '/BTC';
    }
    return coindcxSymbol;
  }
}

module.exports = CoinDCXExchange;