const BaseExchange = require('./BaseExchange');

class IndodaxExchange extends BaseExchange {
  constructor() {
    super({
      name: 'indodax',
      baseURL: 'https://indodax.com/api',
      rateLimit: 167 // 167ms between requests (360/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/summaries';
      const data = await this.makeRequest(endpoint);

      if (!data.tickers) {
        throw new Error('Invalid response from Indodax API');
      }

      let tickers = Object.entries(data.tickers).map(([pair, ticker]) => ({
        ...ticker,
        pair: pair
      }));

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const indodaxSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          indodaxSymbols.includes(ticker.pair)
        );
      }

      // Filter for IDR pairs (Indonesian Rupiah)
      tickers = tickers.filter(ticker =>
        ticker.pair.endsWith('_idr')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Indodax API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Indodax: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 150) {
    try {
      const indodaxSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/depth/${indodaxSymbol}`;

      const data = await this.makeRequest(endpoint);

      return {
        symbol,
        exchange: this.name,
        bids: data.buy.slice(0, limit).map(([price, volume]) => ({
          price: parseFloat(price),
          quantity: parseFloat(volume)
        })),
        asks: data.sell.slice(0, limit).map(([price, volume]) => ({
          price: parseFloat(price),
          quantity: parseFloat(volume)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Indodax order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/IDR -> btc_idr
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toLowerCase();
    } else if (symbol.endsWith('IDR')) {
      const base = symbol.replace('IDR', '');
      return `${base}_idr`.toLowerCase();
    }
    return (symbol + '_idr').toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.change);

    return {
      symbol: this.denormalizeSymbol(ticker.pair),
      price: price,
      volume: parseFloat(ticker.vol_base),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      bid: parseFloat(ticker.buy || price),
      ask: parseFloat(ticker.sell || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(indodaxSymbol) {
    // btc_idr -> BTC/IDR
    return indodaxSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = IndodaxExchange;