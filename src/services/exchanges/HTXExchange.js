const BaseExchange = require('./BaseExchange');

class HTXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'htx',
      baseURL: 'https://api.huobi.pro',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/market/tickers';
      const data = await this.makeRequest(endpoint);

      if (data.status !== 'ok') {
        throw new Error(`HTX API error: ${data['err-msg']}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const htxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          htxSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('usdt') ||
        ticker.symbol.endsWith('btc') ||
        ticker.symbol.endsWith('eth') ||
        ticker.symbol.endsWith('ht')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`HTX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from HTX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      const htxSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/market/depth';
      const params = {
        symbol: htxSymbol,
        type: `step0`,
        depth: limit
      };

      const data = await this.makeRequest(endpoint, params);

      if (data.status !== 'ok') {
        throw new Error(`HTX orderbook error: ${data['err-msg']}`);
      }

      const orderbook = data.tick;

      return {
        symbol,
        exchange: this.name,
        bids: orderbook.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: orderbook.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: orderbook.ts
      };
    } catch (error) {
      console.error(`HTX order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const htxSymbol = this.normalizeSymbol(symbol);
      const htxInterval = this.normalizeInterval(interval);

      const endpoint = '/market/history/kline';
      const params = {
        symbol: htxSymbol,
        period: htxInterval,
        size: limit
      };

      const data = await this.makeRequest(endpoint, params);

      if (data.status !== 'ok') {
        throw new Error(`HTX klines error: ${data['err-msg']}`);
      }

      return data.data.reverse().map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle.id * 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.vol),
        closeTime: new Date((candle.id + this.getIntervalSeconds(interval)) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`HTX klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> btcusdt
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toLowerCase();
    }
    return symbol.toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.close);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.vol),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(htxSymbol) {
    // btcusdt -> BTC/USDT
    const symbol = htxSymbol.toUpperCase();
    if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '') + '/USDT';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    } else if (symbol.endsWith('ETH')) {
      return symbol.replace('ETH', '') + '/ETH';
    } else if (symbol.endsWith('HT')) {
      return symbol.replace('HT', '') + '/HT';
    }
    return symbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '60min',
      '4h': '4hour',
      '1d': '1day',
      '1w': '1week',
      '1M': '1mon',
      '1y': '1year'
    };
    return intervalMap[interval] || '1min';
  }

  getIntervalSeconds(interval) {
    const intervalSeconds = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
      '1w': 604800,
      '1M': 2592000,
      '1y': 31536000
    };
    return intervalSeconds[interval] || 60;
  }
}

module.exports = HTXExchange;