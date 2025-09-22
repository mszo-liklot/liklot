const BaseExchange = require('./BaseExchange');

class DigiFinexExchange extends BaseExchange {
  constructor() {
    super({
      name: 'digifinex',
      baseURL: 'https://openapi.digifinex.com/v3',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 0) {
        throw new Error(`DigiFinex API error: ${data.message}`);
      }

      let tickers = data.ticker;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const digifinexSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          digifinexSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('_usdt') ||
        ticker.symbol.endsWith('_usdc') ||
        ticker.symbol.endsWith('_btc') ||
        ticker.symbol.endsWith('_eth')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`DigiFinex API error:`, error.message);
      throw new Error(`Failed to fetch tickers from DigiFinex: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 150) {
    try {
      const digifinexSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/order_book';
      const params = { symbol: digifinexSymbol, limit };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`DigiFinex orderbook error: ${data.message}`);
      }

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
        timestamp: parseInt(data.date)
      };
    } catch (error) {
      console.error(`DigiFinex order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> btc_usdt
    if (symbol.includes('/')) {
      return symbol.replace('/', '_').toLowerCase();
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}_usdt`.toLowerCase();
    }

    if (symbol.includes('_')) {
      return symbol.toLowerCase();
    }

    return `${symbol}_usdt`.toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.change_rate);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.base_vol),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.buy || price),
      ask: parseFloat(ticker.sell || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(digifinexSymbol) {
    // btc_usdt -> BTC/USDT
    return digifinexSymbol.replace('_', '/').toUpperCase();
  }
}

module.exports = DigiFinexExchange;