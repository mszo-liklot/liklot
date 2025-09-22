const BaseExchange = require('./BaseExchange');

class BitfinexExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitfinex',
      baseURL: 'https://api-pub.bitfinex.com/v2',
      rateLimit: 60 // 60ms between requests (1000/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = symbols.length > 0 ?
        `/tickers?symbols=${symbols.map(s => this.normalizeSymbol(s)).join(',')}` :
        '/tickers?symbols=ALL';

      const data = await this.makeRequest(endpoint);

      return data
        .filter(ticker => ticker[0].startsWith('t')) // Only trading pairs
        .map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitfinex API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitfinex: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 25) {
    try {
      const bitfinexSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/book/${bitfinexSymbol}/P0?len=${limit}`;

      const data = await this.makeRequest(endpoint);

      const bids = data.filter(item => item[2] > 0);
      const asks = data.filter(item => item[2] < 0);

      return {
        symbol,
        exchange: this.name,
        bids: bids.map(([price, count, amount]) => ({
          price: parseFloat(price),
          quantity: Math.abs(parseFloat(amount))
        })),
        asks: asks.map(([price, count, amount]) => ({
          price: parseFloat(price),
          quantity: Math.abs(parseFloat(amount))
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Bitfinex order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const bitfinexSymbol = this.normalizeSymbol(symbol);
      const bitfinexInterval = this.normalizeInterval(interval);

      const endpoint = `/candles/trade:${bitfinexInterval}:${bitfinexSymbol}/hist?limit=${limit}`;

      const data = await this.makeRequest(endpoint);

      return data.reverse().map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        close: parseFloat(candle[2]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: new Date(candle[0] + this.getIntervalMs(interval) - 1)
      }));
    } catch (error) {
      console.error(`Bitfinex klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> tBTCUSDT
    if (symbol.includes('/')) {
      return 't' + symbol.replace('/', '').toUpperCase();
    }
    if (!symbol.startsWith('t')) {
      return 't' + symbol.toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const [symbol, bid, bidSize, ask, askSize, dailyChange, dailyChangeRel, lastPrice, volume, high, low] = ticker;

    return {
      symbol: this.denormalizeSymbol(symbol),
      price: parseFloat(lastPrice),
      volume: parseFloat(volume),
      high: parseFloat(high),
      low: parseFloat(low),
      change: parseFloat(dailyChange),
      changePercent: parseFloat(dailyChangeRel) * 100,
      bid: parseFloat(bid),
      ask: parseFloat(ask),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitfinexSymbol) {
    // tBTCUSDT -> BTC/USDT
    const symbol = bitfinexSymbol.replace('t', '');
    if (symbol.endsWith('USD')) {
      return symbol.replace('USD', '') + '/USD';
    } else if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '') + '/USDT';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    }
    return symbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '3h': '3h',
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
      '3h': 3 * 60 * 60 * 1000,
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

module.exports = BitfinexExchange;