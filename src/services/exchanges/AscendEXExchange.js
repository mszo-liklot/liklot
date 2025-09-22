const BaseExchange = require('./BaseExchange');

class AscendEXExchange extends BaseExchange {
  constructor() {
    super({
      name: 'ascendex',
      baseURL: 'https://ascendex.com/api/pro/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (data.code !== 0) {
        throw new Error(`AscendEX API error: ${data.reason}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const ascendexSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          ascendexSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('/USDT') ||
        ticker.symbol.endsWith('/USDC') ||
        ticker.symbol.endsWith('/BTC') ||
        ticker.symbol.endsWith('/ETH')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`AscendEX API error:`, error.message);
      throw new Error(`Failed to fetch tickers from AscendEX: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const ascendexSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/depth';
      const params = { symbol: ascendexSymbol };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== 0) {
        throw new Error(`AscendEX orderbook error: ${data.reason}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.slice(0, limit).map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: data.data.asks.slice(0, limit).map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: data.data.ts
      };
    } catch (error) {
      console.error(`AscendEX order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTC/USDT (already correct format)
    if (symbol.includes('/')) {
      return symbol.toUpperCase();
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}/USDT`;
    }
    return `${symbol}/USDT`.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.close);
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.changePercent);

    return {
      symbol: ticker.symbol, // Already in correct format
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: parseFloat(ticker.open),
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: parseInt(ticker.ts),
      exchange: this.name
    };
  }
}

module.exports = AscendEXExchange;