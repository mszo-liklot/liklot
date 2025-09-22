const BaseExchange = require('./BaseExchange');

class ProBitExchange extends BaseExchange {
  constructor() {
    super({
      name: 'probit',
      baseURL: 'https://api.probit.com/api/exchange/v1',
      rateLimit: 167 // 167ms between requests (360/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker';
      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error(`ProBit API error: Invalid response`);
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const probitSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          probitSymbols.includes(ticker.market_id)
        );
      }

      // Filter for major trading pairs
      tickers = tickers.filter(ticker =>
        ticker.market_id.endsWith('-USDT') ||
        ticker.market_id.endsWith('-USDC') ||
        ticker.market_id.endsWith('-BTC') ||
        ticker.market_id.endsWith('-ETH') ||
        ticker.market_id.endsWith('-PROB')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`ProBit API error:`, error.message);
      throw new Error(`Failed to fetch tickers from ProBit: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const probitSymbol = this.normalizeSymbol(symbol);
      const endpoint = '/order_book';
      const params = { market_id: probitSymbol };

      const data = await this.makeRequest(endpoint, params);

      if (!data.data) {
        throw new Error(`ProBit orderbook error: Invalid response`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.quantity)
        })),
        asks: data.data.asks.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.quantity)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`ProBit order book error:`, error.message);
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
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.change);
    const changePercent = parseFloat(ticker.change_percent);

    return {
      symbol: this.denormalizeSymbol(ticker.market_id),
      price: price,
      volume: parseFloat(ticker.base_volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: new Date(ticker.time).getTime(),
      exchange: this.name
    };
  }

  denormalizeSymbol(probitSymbol) {
    // BTC-USDT -> BTC/USDT
    return probitSymbol.replace('-', '/');
  }
}

module.exports = ProBitExchange;