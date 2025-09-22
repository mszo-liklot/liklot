const BaseExchange = require('./BaseExchange');

class PhemexExchange extends BaseExchange {
  constructor() {
    super({
      name: 'phemex',
      baseURL: 'https://api.phemex.com',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/md/spot/ticker/24hr/all';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 0) {
        throw new Error(`Phemex API error: ${data.msg}`);
      }

      let tickers = data.result;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const phemexSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          phemexSymbols.includes(ticker.symbol)
        );
      }

      // Filter for spot trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('USDT') ||
        ticker.symbol.endsWith('USD') ||
        ticker.symbol.endsWith('BTC') ||
        ticker.symbol.endsWith('ETH')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Phemex API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Phemex: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 30) {
    try {
      const phemexSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/md/orderbook';
      const params = { symbol: phemexSymbol };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`Phemex orderbook error: ${data.msg}`);
      }

      const book = data.result.book;

      return {
        symbol,
        exchange: this.name,
        bids: book.bids.slice(0, limit).map(([price, size]) => ({
          price: parseFloat(price) / 10000, // Phemex uses scaled prices
          quantity: parseFloat(size) / 100000000 // Phemex uses scaled sizes
        })),
        asks: book.asks.slice(0, limit).map(([price, size]) => ({
          price: parseFloat(price) / 10000,
          quantity: parseFloat(size) / 100000000
        })),
        timestamp: book.timestamp
      };
    } catch (error) {
      console.error(`Phemex order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const phemexSymbol = this.normalizeSymbol(symbol);
      const phemexInterval = this.normalizeInterval(interval);

      const to = Math.floor(Date.now() / 1000);
      const from = to - (limit * this.getIntervalSeconds(interval));

      const endpoint = '/md/kline';
      const params = {
        symbol: phemexSymbol,
        resolution: phemexInterval,
        from,
        to
      };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`Phemex klines error: ${data.msg}`);
      }

      const klines = data.result;

      return klines.rows.map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle[0] * 1000),
        open: parseFloat(candle[3]) / 10000, // Phemex uses scaled prices
        high: parseFloat(candle[4]) / 10000,
        low: parseFloat(candle[5]) / 10000,
        close: parseFloat(candle[6]) / 10000,
        volume: parseFloat(candle[1]) / 100000000, // Phemex uses scaled volumes
        closeTime: new Date((candle[0] + this.getIntervalSeconds(interval)) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`Phemex klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTCUSDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.close) / 10000; // Phemex uses scaled prices
    const open = parseFloat(ticker.open) / 10000;
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume) / 100000000, // Phemex uses scaled volumes
      high: parseFloat(ticker.high) / 10000,
      low: parseFloat(ticker.low) / 10000,
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bid || ticker.close) / 10000,
      ask: parseFloat(ticker.ask || ticker.close) / 10000,
      timestamp: ticker.timestamp,
      exchange: this.name
    };
  }

  denormalizeSymbol(phemexSymbol) {
    // BTCUSDT -> BTC/USDT
    if (phemexSymbol.endsWith('USDT')) {
      return phemexSymbol.replace('USDT', '') + '/USDT';
    } else if (phemexSymbol.endsWith('USD')) {
      return phemexSymbol.replace('USD', '') + '/USD';
    } else if (phemexSymbol.endsWith('BTC')) {
      return phemexSymbol.replace('BTC', '') + '/BTC';
    } else if (phemexSymbol.endsWith('ETH')) {
      return phemexSymbol.replace('ETH', '') + '/ETH';
    }
    return phemexSymbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '1w': 604800,
      '1M': 2592000
    };
    return intervalMap[interval] || 60;
  }

  getIntervalSeconds(interval) {
    return this.normalizeInterval(interval);
  }
}

module.exports = PhemexExchange;