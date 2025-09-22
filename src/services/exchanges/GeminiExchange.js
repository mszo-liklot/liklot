const BaseExchange = require('./BaseExchange');

class GeminiExchange extends BaseExchange {
  constructor() {
    super({
      name: 'gemini',
      baseURL: 'https://api.gemini.com/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      // Get all available symbols first
      const symbolsData = await this.makeRequest('/symbols');

      let targetSymbols = symbolsData;
      if (symbols.length > 0) {
        const geminiSymbols = symbols.map(s => this.normalizeSymbol(s));
        targetSymbols = symbolsData.filter(symbol =>
          geminiSymbols.includes(symbol)
        );
      }

      const tickers = [];
      for (const symbol of targetSymbols) {
        try {
          const ticker = await this.makeRequest(`/pubticker/${symbol}`);
          const stats24h = await this.makeRequest(`/stats/${symbol}`);

          tickers.push(this.standardizeTicker({
            ...ticker,
            ...stats24h,
            symbol: symbol
          }));

          // Rate limiting between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(`Failed to get ticker for ${symbol}:`, error.message);
        }
      }

      return tickers;
    } catch (error) {
      console.error(`Gemini API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Gemini: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const geminiSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/book/${geminiSymbol}?limit_bids=${limit}&limit_asks=${limit}`;

      const data = await this.makeRequest(endpoint);

      return {
        symbol,
        exchange: this.name,
        bids: data.bids.map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.amount)
        })),
        asks: data.asks.map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.amount)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Gemini order book error:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      const geminiSymbol = this.normalizeSymbol(symbol);
      const geminiInterval = this.normalizeInterval(interval);

      const endpoint = `/candles/${geminiSymbol}/${geminiInterval}`;

      const data = await this.makeRequest(endpoint);

      return data.slice(0, limit).reverse().map(candle => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: new Date(candle[0] + this.getIntervalMs(interval) - 1)
      }));
    } catch (error) {
      console.error(`Gemini klines error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/USD -> btcusd
    if (symbol.includes('/')) {
      return symbol.replace('/', '').toLowerCase();
    }
    return symbol.toLowerCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last || ticker.close);
    const volume = parseFloat(ticker.volume || 0);

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      volume: volume,
      high: parseFloat(ticker.high || price),
      low: parseFloat(ticker.low || price),
      change: parseFloat(ticker.change || 0),
      changePercent: parseFloat(ticker.percentChange || 0),
      bid: parseFloat(ticker.bid || price),
      ask: parseFloat(ticker.ask || price),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(geminiSymbol) {
    // btcusd -> BTC/USD
    const symbol = geminiSymbol.toUpperCase();
    if (symbol.endsWith('USD')) {
      return symbol.replace('USD', '') + '/USD';
    } else if (symbol.endsWith('BTC')) {
      return symbol.replace('BTC', '') + '/BTC';
    } else if (symbol.endsWith('ETH')) {
      return symbol.replace('ETH', '') + '/ETH';
    }
    return symbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1hr',
      '6h': '6hr',
      '1d': '1day'
    };
    return intervalMap[interval] || '1m';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = GeminiExchange;