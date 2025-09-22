const BaseExchange = require('./BaseExchange');

class BitstampExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitstamp',
      baseURL: 'https://www.bitstamp.net/api/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker/';
      const data = await this.makeRequest(endpoint);

      // Bitstamp returns all tickers, filter if symbols specified
      let tickers = Object.entries(data).map(([pair, ticker]) => ({
        ...ticker,
        pair: pair
      }));

      if (symbols.length > 0) {
        const bitstampSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitstampSymbols.includes(ticker.pair)
        );
      }

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitstamp API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitstamp: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const bitstampSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/order_book/${bitstampSymbol}/`;

      const data = await this.makeRequest(endpoint);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.slice(0, limit).map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.asks.slice(0, limit).map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: parseInt(data.timestamp) * 1000
      };
    } catch (error) {
      console.error(`Bitstamp order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const bitstampSymbol = this.normalizeSymbol(symbol);
      const bitstampInterval = this.normalizeInterval(interval);

      const endpoint = `/ohlc/${bitstampSymbol}/?step=${bitstampInterval}&limit=${limit}`;

      const data = await this.makeRequest(endpoint);

      return data.data.ohlc.map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle.timestamp * 1000),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        closeTime: new Date((candle.timestamp + bitstampInterval) * 1000 - 1)
      }));
    } catch (error) {
      console.error(`Bitstamp klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USD -> btcusd
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toLowerCase();
    }
    return symbol.toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.pair),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
      timestamp: parseInt(ticker.timestamp) * 1000,
      exchange: this.name
    };
  }

  denormalizeSymbol(bitstampSymbol) {
    // btcusd -> BTC/USD
    const symbol = bitstampSymbol.toUpperCase();
    if (symbol.endsWith('USD')) {
      return symbol.replace('USD', '') + '/USD';
    } else if (symbol.endsWith('EUR')) {
      return symbol.replace('EUR', '') + '/EUR';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    }
    return symbol;
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
      '3d': 259200
    };
    return intervalMap[interval] || 60;
  }
}

module.exports = BitstampExchange;