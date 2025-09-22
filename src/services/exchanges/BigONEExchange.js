const BaseExchange = require('./BaseExchange');

class BigONEExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bigone',
      baseURL: 'https://big.one/api/v3',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/asset_pairs/tickers';
      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error(`BigONE API error: ${data.errors?.[0]?.message || 'Unknown error'}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bigoneSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bigoneSymbols.includes(ticker.asset_pair_name)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.asset_pair_name.endsWith('-USDT') ||
        ticker.asset_pair_name.endsWith('-USDC') ||
        ticker.asset_pair_name.endsWith('-BTC') ||
        ticker.asset_pair_name.endsWith('-ETH') ||
        ticker.asset_pair_name.endsWith('-ONE')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`BigONE API error:`, error.message);
      throw new Error(`Failed to fetch tickers from BigONE: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 200) {
    try {
      const bigoneSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/asset_pairs/${bigoneSymbol}/depth`;
      const params = { limit };

      const data = await this.makeRequest(endpoint, params);

      if (!data.data) {
        throw new Error(`BigONE orderbook error: ${data.errors?.[0]?.message || 'Unknown error'}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.order_count)
        })),
        asks: data.data.asks.map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.order_count)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`BigONE order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTC-USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '-').toUpperCase();
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}-USDT`;
    }

    if (symbol.includes('-')) {
      return symbol.toUpperCase();
    }

    return `${symbol}-USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.close);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.asset_pair_name),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.daily_change_high),
      low: parseFloat(ticker.daily_change_low),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bid?.price || price),
      ask: parseFloat(ticker.ask?.price || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(bigoneSymbol) {
    // BTC-USDT -> BTC/USDT
    return bigoneSymbol.replace('-', '/');
  }
}

module.exports = BigONEExchange;