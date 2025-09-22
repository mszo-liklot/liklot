const BaseExchange = require('./BaseExchange');

class WhiteBitExchange extends BaseExchange {
  constructor() {
    super({
      name: 'whitebit',
      baseURL: 'https://whitebit.com/api/v4/public',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      let tickers = Object.entries(data).map(([pair, ticker]) => ({
        ...ticker,
        pair: pair
      }));

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const whitebitSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          whitebitSymbols.includes(ticker.pair)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.pair.endsWith('_USDT') ||
        ticker.pair.endsWith('_USD') ||
        ticker.pair.endsWith('_BTC') ||
        ticker.pair.endsWith('_ETH') ||
        ticker.pair.endsWith('_WBT')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`WhiteBit API error:`, error.message);
      throw new Error(`Failed to fetch tickers from WhiteBit: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const whitebitSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/orderbook/${whitebitSymbol}`;
      const params = { limit };

      const data = await this.makeRequest(endpoint, params);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`WhiteBit order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const whitebitSymbol = this.normalizeSymbol(symbol);
      const whitebitInterval = this.normalizeInterval(interval);

      const endpoint = `/kline`;
      const params = {
        market: whitebitSymbol,
        interval: whitebitInterval,
        limit
      };

      const data = await this.makeRequest(endpoint, params);

      return data.map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle[0] * 1000),
        open: parseFloat(candle[1]),
        close: parseFloat(candle[2]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: new Date((candle[0] + this.getIntervalSeconds(interval)) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`WhiteBit klines error:`, error.message);
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
    }

    if (symbol.includes('_')) {
      return symbol.toUpperCase();
    }

    return `${symbol}_USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_price);
    const change = parseFloat(ticker.price_change);
    const changePercent = parseFloat(ticker.price_change_percent);

    return {
      symbol: this.denormalizeSymbol(ticker.pair),
      price: price,
      volume: parseFloat(ticker.base_volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: parseFloat(ticker.open),
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(whitebitSymbol) {
    // BTC_USDT -> BTC/USDT
    return whitebitSymbol.replace('_', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '2h': '2h',
      '4h': '4h',
      '6h': '6h',
      '8h': '8h',
      '12h': '12h',
      '1d': '1d',
      '3d': '3d',
      '1w': '1w',
      '1M': '1M'
    };
    return intervalMap[interval] || '1m';
  }

  getIntervalSeconds(interval) {
    const intervalSeconds = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
      '3d': 259200,
      '1w': 604800,
      '1M': 2592000
    };
    return intervalSeconds[interval] || 60;
  }
}

module.exports = WhiteBitExchange;