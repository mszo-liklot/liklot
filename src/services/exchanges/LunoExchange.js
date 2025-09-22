const BaseExchange = require('./BaseExchange');

class LunoExchange extends BaseExchange {
  constructor() {
    super({
      name: 'luno',
      baseURL: 'https://api.luno.com/api/1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/tickers';
      const data = await this.makeRequest(endpoint);

      let tickers = data.tickers;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const lunoSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          lunoSymbols.includes(ticker.pair)
        );
      }

      // Filter for major trading pairs (ZAR, EUR, USD, NGN, UGX, ZMW)
      tickers = tickers.filter(ticker =>
        ticker.pair.endsWith('ZAR') ||
        ticker.pair.endsWith('EUR') ||
        ticker.pair.endsWith('USD') ||
        ticker.pair.endsWith('NGN') ||
        ticker.pair.endsWith('UGX') ||
        ticker.pair.endsWith('ZMW')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Luno API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Luno: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const lunoSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/orderbook_top';
      const params = { pair: lunoSymbol };

      const data = await this.makeRequest(endpoint, params);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.slice(0, limit).map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.volume)
        })),
        asks: data.asks.slice(0, limit).map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.volume)
        })),
        timestamp: parseInt(data.timestamp)
      };
    } catch (error) {
      console.error(`Luno order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1h', limit = 1000) {
    try {
      const lunoSymbol = this.normalizeSymbol(symbol);
      const since = Date.now() - (limit * this.getIntervalMs(interval));

      const endpoint = '/candles';
      const params = {
        pair: lunoSymbol,
        duration: this.normalizeInterval(interval),
        since: since
      };

      const data = await this.makeRequest(endpoint, params);

      return data.candles.slice(-limit).map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle.timestamp * 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        closeTime: new Date((candle.timestamp + this.getIntervalSeconds(interval)) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`Luno klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/ZAR -> XBTZAR
    if (symbol.includes('/')) {
      let [base, quote] = symbol.split('/');
      // Luno uses XBT instead of BTC
      if (base === 'BTC') base = 'XBT';
      return `${base}${quote}`;
    } else if (symbol.startsWith('BTC')) {
      return symbol.replace('BTC', 'XBT');
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_trade);
    const change = parseFloat(ticker.rolling_24_hour_volume);

    return {
      symbol: this.denormalizeSymbol(ticker.pair),
      price: price,
      volume: parseFloat(ticker.rolling_24_hour_volume),
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(lunoSymbol) {
    // XBTZAR -> BTC/ZAR
    if (lunoSymbol.startsWith('XBT')) {
      const quote = lunoSymbol.replace('XBT', '');
      return `BTC/${quote}`;
    }

    // Handle other pairs like ETHZAR -> ETH/ZAR
    const commonQuotes = ['ZAR', 'EUR', 'USD', 'NGN', 'UGX', 'ZMW'];
    for (const quote of commonQuotes) {
      if (lunoSymbol.endsWith(quote)) {
        const base = lunoSymbol.replace(quote, '');
        return `${base}/${quote}`;
      }
    }

    return lunoSymbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    };
    return intervalMap[interval] || 3600;
  }

  getIntervalMs(interval) {
    return this.normalizeInterval(interval) * 1000;
  }

  getIntervalSeconds(interval) {
    return this.normalizeInterval(interval);
  }
}

module.exports = LunoExchange;