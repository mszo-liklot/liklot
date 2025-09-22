const BaseExchange = require('./BaseExchange');

class WazirXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'wazirx',
      baseURL: 'https://api.wazirx.com/api/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/tickers';
      const data = await this.makeRequest(endpoint);

      let tickers = Object.entries(data).map(([symbol, ticker]) => ({
        ...ticker,
        symbol: symbol
      }));

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const wazirxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          wazirxSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs (INR, USDT, BTC)
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('inr') ||
        ticker.symbol.endsWith('usdt') ||
        ticker.symbol.endsWith('btc') ||
        ticker.symbol.endsWith('wrx')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`WazirX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from WazirX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      const wazirxSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/depth';
      const params = { market: wazirxSymbol, limit };

      const data = await this.makeRequest(endpoint, params);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.map(([price, volume]) => ({
          price: parseFloat(price),
          quantity: parseFloat(volume)
        })),
        asks: data.asks.map(([price, volume]) => ({
          price: parseFloat(price),
          quantity: parseFloat(volume)
        })),
        timestamp: parseInt(data.timestamp) * 1000
      };
    } catch (error) {
      console.error(`WazirX order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/INR -> btcinr
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toLowerCase();
    } else if (symbol.endsWith('INR')) {
      return symbol.toLowerCase();
    } else if (symbol.endsWith('USDT')) {
      return symbol.toLowerCase();
    }
    return (symbol + 'inr').toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.buy || price),
      ask: parseFloat(ticker.sell || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(wazirxSymbol) {
    // btcinr -> BTC/INR
    const symbol = wazirxSymbol.toUpperCase();
    if (symbol.endsWith('INR')) {
      return symbol.replace('INR', '') + '/INR';
    } else if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '') + '/USDT';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    } else if (symbol.endsWith('WRX')) {
      return symbol.replace('WRX', '') + '/WRX';
    }
    return symbol;
  }
}

module.exports = WazirXExchange;