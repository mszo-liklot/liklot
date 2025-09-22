const BaseExchange = require('./BaseExchange');

class TokenizeExchange extends BaseExchange {
  constructor() {
    super({
      name: 'tokenize',
      baseURL: 'https://api.tokenize.exchange/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/market/tickers';
      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error('Invalid response from Tokenize API');
      }

      let tickers = data.data;

      // Filter by symbols if specified
      if (symbols.length > 0) {
        const tokenizeSymbols = symbols.map(s => this.normalizeSymbol(s));
        tickers = tickers.filter(ticker =>
          tokenizeSymbols.includes(ticker.symbol)
        );
      }

      // Filter for MYR pairs (Malaysian Ringgit) and major stablecoins
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('MYR') ||
        ticker.symbol.endsWith('USDT') ||
        ticker.symbol.endsWith('USDC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Tokenize API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Tokenize: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const tokenizeSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/market/orderbook/${tokenizeSymbol}`;

      const data = await this.makeRequest(endpoint);

      if (!data.data) {
        throw new Error('Invalid orderbook response from Tokenize API');
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.data.bids.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.size)
        })),
        asks: data.data.asks.slice(0, limit).map(order => ({
          price: parseFloat(order.price),
          quantity: parseFloat(order.size)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Tokenize order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/MYR -> BTCMYR
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last_price);
    const change = parseFloat(ticker.price_change_24h);
    const changePercent = parseFloat(ticker.price_change_percent_24h);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: parseFloat(ticker.volume_24h),
      high: parseFloat(ticker.high_24h),
      low: parseFloat(ticker.low_24h),
      change: change,
      changePercent: changePercent,
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(tokenizeSymbol) {
    // BTCMYR -> BTC/MYR
    if (tokenizeSymbol.endsWith('MYR')) {
      return tokenizeSymbol.replace('MYR', '') + '/MYR';
    } else if (tokenizeSymbol.endsWith('USDT')) {
      return tokenizeSymbol.replace('USDT', '') + '/USDT';
    } else if (tokenizeSymbol.endsWith('USDC')) {
      return tokenizeSymbol.replace('USDC', '') + '/USDC';
    }
    return tokenizeSymbol;
  }
}

module.exports = TokenizeExchange;