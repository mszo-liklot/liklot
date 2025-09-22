const BaseExchange = require('./BaseExchange');

class BitgetExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bitget',
      baseURL: 'https://api.bitget.com/api/spot/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/market/tickers';
      const data = await this.makeRequest(endpoint);

      if (data.code !== '00000') {
        throw new Error(`Bitget API error: ${data.msg}`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const bitgetSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          bitgetSymbols.includes(ticker.symbol)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('USDT') ||
        ticker.symbol.endsWith('USDC') ||
        ticker.symbol.endsWith('BTC') ||
        ticker.symbol.endsWith('ETH') ||
        ticker.symbol.endsWith('BGB')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Bitget API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Bitget: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 100) {
    try {
      const bitgetSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/market/depth';
      const params = { symbol: bitgetSymbol, limit, type: 'step0' };

      const data = await this.makeRequest(endpoint, params);

      if (data.code !== '00000') {
        throw new Error(`Bitget orderbook error: ${data.msg}`);
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
      console.error(`Bitget order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USDT -> BTCUSDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.close);
    const open = parseFloat(ticker.open);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.baseVol),
      high: parseFloat(ticker.high24h),
      low: parseFloat(ticker.low24h),
      change: change,
      changePercent: changePercent,
      open: open,
      bid: parseFloat(ticker.bidPr || price),
      ask: parseFloat(ticker.askPr || price),
      timestamp: parseInt(ticker.ts),
      exchange: this.name
    };
  }

  denormalizeSymbol(bitgetSymbol) {
    // BTCUSDT -> BTC/USDT
    if (bitgetSymbol.endsWith('USDT')) {
      return bitgetSymbol.replace('USDT', '') + '/USDT';
    } else if (bitgetSymbol.endsWith('USDC')) {
      return bitgetSymbol.replace('USDC', '') + '/USDC';
    } else if (bitgetSymbol.endsWith('BTC')) {
      return bitgetSymbol.replace('BTC', '') + '/BTC';
    } else if (bitgetSymbol.endsWith('ETH')) {
      return bitgetSymbol.replace('ETH', '') + '/ETH';
    }
    return bitgetSymbol;
  }
}

module.exports = BitgetExchange;