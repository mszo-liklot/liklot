const BaseExchange = require('./BaseExchange');

class PoloniexExchange extends BaseExchange {
  constructor() {
    super({
      name: 'poloniex',
      baseURL: 'https://api.poloniex.com',
      rateLimit: 167 // 167ms between requests (360/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/markets/ticker24h';
      const data = await this.makeRequest(endpoint);

      let tickers = data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const poloniexSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          poloniexSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('_USDT') ||
        ticker.symbol.endsWith('_USDC') ||
        ticker.symbol.endsWith('_BTC') ||
        ticker.symbol.endsWith('_ETH') ||
        ticker.symbol.endsWith('_TRX')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Poloniex API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Poloniex: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const poloniexSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/markets/${poloniexSymbol}/orderBook`;
      const params = { limit, scale: '1' };

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
        timestamp: parseInt(data.ts)
      };
    } catch (error) {
      console.error(`Poloniex order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const poloniexSymbol = this.normalizeSymbol(symbol);
      const poloniexInterval = this.normalizeInterval(interval);

      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (limit * this.getIntervalSeconds(interval));

      const endpoint = `/markets/${poloniexSymbol}/candles`;
      const params = {
        interval: poloniexInterval,
        startTime,
        endTime,
        limit
      };

      const data = await this.makeRequest(endpoint, params);

      return data.map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle[5] * 1000),
        low: parseFloat(candle[0]),
        high: parseFloat(candle[1]),
        open: parseFloat(candle[2]),
        close: parseFloat(candle[3]),
        volume: parseFloat(candle[4]),
        closeTime: new Date((candle[5] + this.getIntervalSeconds(interval)) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`Poloniex klines error:`, error.message);
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
    } else if (symbol.endsWith('USDC')) {
      const base = symbol.replace('USDC', '');
      return `${base}_USDC`;
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
    const price = parseFloat(ticker.close);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.quantity),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bidPrice || price),
      ask: parseFloat(ticker.askPrice || price),
      timestamp: parseInt(ticker.ts),
      exchange: this.name
    };
  }

  denormalizeSymbol(poloniexSymbol) {
    // BTC_USDT -> BTC/USDT
    return poloniexSymbol.replace('_', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 'MINUTE_1',
      '5m': 'MINUTE_5',
      '10m': 'MINUTE_10',
      '15m': 'MINUTE_15',
      '30m': 'MINUTE_30',
      '1h': 'HOUR_1',
      '2h': 'HOUR_2',
      '4h': 'HOUR_4',
      '6h': 'HOUR_6',
      '12h': 'HOUR_12',
      '1d': 'DAY_1',
      '3d': 'DAY_3',
      '1w': 'WEEK_1',
      '1M': 'MONTH_1'
    };
    return intervalMap[interval] || 'MINUTE_1';
  }

  getIntervalSeconds(interval) {
    const intervalSeconds = {
      '1m': 60,
      '5m': 300,
      '10m': 600,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '12h': 43200,
      '1d': 86400,
      '3d': 259200,
      '1w': 604800,
      '1M': 2592000
    };
    return intervalSeconds[interval] || 60;
  }
}

module.exports = PoloniexExchange;