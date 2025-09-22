const BaseExchange = require('./BaseExchange');

class CryptoComExchange extends BaseExchange {
  constructor() {
    super({
      name: 'crypto_com',
      baseURL: 'https://api.crypto.com/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/public/get-ticker';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 0) {
        throw new Error(`Crypto.com API error: ${data.message}`);
      }

      let tickers = data.result.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const cryptoComSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          cryptoComSymbols.includes(ticker.i)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.i.endsWith('_USDT') ||
        ticker.i.endsWith('_USD') ||
        ticker.i.endsWith('_BTC') ||
        ticker.i.endsWith('_ETH') ||
        ticker.i.endsWith('_CRO')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Crypto.com API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Crypto.com: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const cryptoComSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/public/get-book';
      const params = {
        instrument_name: cryptoComSymbol,
        depth: limit
      };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`Crypto.com orderbook error: ${data.message}`);
      }

      const orderbook = data.result.data[0];

      return {
        symbol,
        exchange: this.name,
        bids: orderbook.bids.map(([price, quantity, count]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: orderbook.asks.map(([price, quantity, count]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: orderbook.t
      };
    } catch (error) {
      console.error(`Crypto.com order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const cryptoComSymbol = this.normalizeSymbol(symbol);
      const cryptoComInterval = this.normalizeInterval(interval);

      const endpoint = '/public/get-candlestick';
      const params = {
        instrument_name: cryptoComSymbol,
        timeframe: cryptoComInterval,
        count: limit
      };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`Crypto.com klines error: ${data.message}`);
      }

      return data.result.data.reverse().map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle.t),
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
        volume: parseFloat(candle.v),
        closeTime: new Date(candle.t + this.getIntervalMs(interval) - 1)
      }));
    } catch (error) {
      console.error(`Crypto.com klines error:`, error.message);
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
    } else if (symbol.endsWith('USD')) {
      const base = symbol.replace('USD', '');
      return `${base}_USD`;
    } else if (symbol.endsWith('BTC')) {
      const base = symbol.replace('BTC', '');
      return `${base}_BTC`;
    }

    if (symbol.includes('_')) {
      return symbol.toUpperCase();
    }

    return `${symbol}_USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.a);
    const change = parseFloat(ticker.c);
    const changePercent = parseFloat(ticker.cp);

    return {
      symbol: this.denormalizeSymbol(ticker.i),
      price: price,
      volume: parseFloat(ticker.v),
      high: parseFloat(ticker.h),
      low: parseFloat(ticker.l),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.b),
      ask: parseFloat(ticker.k),
      timestamp: ticker.t,
      exchange: this.name
    };
  }

  denormalizeSymbol(cryptoComSymbol) {
    // BTC_USDT -> BTC/USDT
    return cryptoComSymbol.replace('_', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '6h': '6h',
      '12h': '12h',
      '1d': '1D',
      '1w': '7D',
      '2w': '14D',
      '1M': '1M'
    };
    return intervalMap[interval] || '1m';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '2w': 14 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };
    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = CryptoComExchange;