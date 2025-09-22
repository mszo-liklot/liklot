const BaseExchange = require('./BaseExchange');

class CoinWExchange extends BaseExchange {
  constructor() {
    super({
      name: 'coinw',
      baseURL: 'https://api.coinw.com/appApi/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/public/getAllTicker';
      const data = await this.makeRequest(endpoint);

      if (data.code !== '0') {
        throw new Error(`CoinW API error: ${data.msg}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const coinwSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          coinwSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('usdt') ||
        ticker.symbol.endsWith('usdc') ||
        ticker.symbol.endsWith('btc') ||
        ticker.symbol.endsWith('eth')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`CoinW API error:`, error.message);
      throw new Error(`Failed to fetch tickers from CoinW: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const coinwSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/public/getDepth';
      const params = { symbol: coinwSymbol, size: limit };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== '0') {
        throw new Error(`CoinW orderbook error: ${data.msg}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: parseInt(data.data.timestamp)
      };
    } catch (error) {
      console.error(`CoinW order book error:`, error.message);
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
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.rose) * 100;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.vol),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: parseFloat(ticker.open),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(coinwSymbol) {
    // btcusdt -> BTC/USDT
    const symbol = coinwSymbol.toUpperCase();
    if (symbol.endsWith('USDT')) {
      return symbol.replace('USDT', '') + '/USDT';
    } else if (symbol.endsWith('USDC')) {
      return symbol.replace('USDC', '') + '/USDC';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    } else if (symbol.endsWith('ETH')) {
      return symbol.replace('ETH', '') + '/ETH';
    }
    return symbol;
  }
}

module.exports = CoinWExchange;