const BaseExchange = require('./BaseExchange');

class KorbitExchange extends BaseExchange {
  constructor() {
    super({
      name: 'korbit',
      baseURL: 'https://api.korbit.co.kr/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker/detailed/all';
      const data = await this.makeRequest(endpoint);

      const tickers = [];
      for (const [pair, ticker] of Object.entries(data)) {
        // Filter by symbols if specified
        if (symbols.length > 0) {
          const korbitSymbols = symbols.map(s => this.normalizeSymbol(s));
          if (!korbitSymbols.includes(pair)) {
            continue;
          }
        }

        tickers.push(this.standardizeTicker({
          ...ticker,
          pair: pair
        }));
      }

      return tickers;
    } catch (error) {
      console.error(`Korbit API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Korbit: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 40) {
    try {
      const korbitSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/orderbook?currency_pair=${korbitSymbol}`;

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
        timestamp: parseInt(data.timestamp)
      };
    } catch (error) {
      console.error(`Korbit order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/KRW -> btc_krw
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toLowerCase();
    } else if (symbol.endsWith('KRW')) {
      const base = symbol.replace('KRW', '');
      return `${base}_krw`.toLowerCase();
    }
    return symbol.toLowerCase();
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
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
      timestamp: parseInt(ticker.timestamp),
      exchange: this.name
    };
  }

  denormalizeSymbol(korbitSymbol) {
    // btc_krw -> BTC/KRW
    return korbitSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = KorbitExchange;