const BaseExchange = require('./BaseExchange');

class BitpandaExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitpanda',
      baseURL: 'https://api.exchange.bitpanda.com/public/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/market-ticker';
      const data = await this.makeRequest(endpoint);

      let tickers = data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bitpandaSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitpandaSymbols.includes(ticker.instrument_code)
        );
      }

      // Filter for major EUR, USD, BTC trading pairs
      tickers = tickers.filter(ticker =>
        ticker.instrument_code.endsWith('_EUR') ||
        ticker.instrument_code.endsWith('_USD') ||
        ticker.instrument_code.endsWith('_BTC') ||
        ticker.instrument_code.endsWith('_BEST')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitpanda API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitpanda: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const bitpandaSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/order-book/${bitpandaSymbol}`;

      const data = await this.makeRequest(endpoint);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.slice(0, limit).map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.amount)
        })),
        asks: data.asks.slice(0, limit).map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.amount)
        })),
        timestamp: new Date(data.time).getTime()
      };
    } catch (error) {
      console.error(`Bitpanda order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const bitpandaSymbol = this.normalizeSymbol(symbol);
      const bitpandaInterval = this.normalizeInterval(interval);

      const endpoint = `/candlesticks/${bitpandaSymbol}`;
      const params = {
        unit: bitpandaInterval,
        period: limit
      };

      const data = await this.makeRequest(endpoint, params);

      return data.reverse().map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle.time),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        closeTime: new Date(new Date(candle.time).getTime() + this.getIntervalMs(interval) - 1)
      }));
    } catch (error) {
      console.error(`Bitpanda klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/EUR -> BTC_EUR
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toUpperCase();
    } else if (symbol.endsWith('EUR')) {
      const base = symbol.replace('EUR', '');
      return `${base}_EUR`;
    } else if (symbol.endsWith('USD')) {
      const base = symbol.replace('USD', '');
      return `${base}_USD`;
    }

    if (symbol.includes('_')) {
      return symbol.toUpperCase();
    }

    return `${symbol}_EUR`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_price);
    const change = parseFloat(ticker.price_change);
    const changePercent = parseFloat(ticker.price_change_percentage);

    return {
      symbol: this.denormalizeSymbol(ticker.instrument_code),
      price: price,
      volume: parseFloat(ticker.base_volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.best_bid),
      ask: parseFloat(ticker.best_ask),
      timestamp: new Date(ticker.time).getTime(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitpandaSymbol) {
    // BTC_EUR -> BTC/EUR
    return bitpandaSymbol.replace('_', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 'MINUTES',
      '5m': 'MINUTES',
      '15m': 'MINUTES',
      '30m': 'MINUTES',
      '1h': 'HOURS',
      '4h': 'HOURS',
      '1d': 'DAYS',
      '1w': 'WEEKS'
    };
    return intervalMap[interval] || 'MINUTES';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };
    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = BitpandaExchange;