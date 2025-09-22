const BaseExchange = require('./BaseExchange');

class BTCTurkExchange extends BaseExchange {
  constructor() {
    super({
      name: 'btcturk',
      baseURL: 'https://api.btcturk.com/api/v2',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error('Invalid response from BTCTurk API');
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const btcturkSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          btcturkSymbols.includes(ticker.pair)
        );
      }

      // Filter for TRY (Turkish Lira) and major stablecoin pairs
      tickers = tickers.filter(ticker =>
        ticker.pair.endsWith('TRY') ||
        ticker.pair.endsWith('USDT') ||
        ticker.pair.endsWith('BTC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`BTCTurk API error:`, error.message);
      throw new Error(`Failed to fetch tickers from BTCTurk: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const btcturkSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/orderbook?pairSymbol=${btcturkSymbol}&limit=${limit}`;

      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error('Invalid orderbook response from BTCTurk API');
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        asks: data.data.asks.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.amount)
        })),
        timestamp: data.data.timestamp
      };
    } catch (error) {
      console.error(`BTCTurk order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/TRY -> BTCTRY
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.changePercent);

    return {
      symbol: this.denormalizeSymbol(ticker.pair),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: ticker.timestamp,
      exchange: this.name
    };
  }

  denormalizeSymbol(btcturkSymbol) {
    // BTCTRY -> BTC/TRY
    if (btcturkSymbol.endsWith('TRY')) {
      return btcturkSymbol.replace('TRY', '') + '/TRY';
    } else if (btcturkSymbol.endsWith('USDT')) {
      return btcturkSymbol.replace('USDT', '') + '/USDT';
    } else if (btcturkSymbol.endsWith('BTC')) {
      return btcturkSymbol.replace('BTC', '') + '/BTC';
    }
    return btcturkSymbol;
  }
}

module.exports = BTCTurkExchange;