const BaseExchange = require('./BaseExchange');

class BinanceExchange extends BaseExchange {
  constructor() {
    super({
      name: 'binance',
      baseURL: 'https://api.binance.com',
      rateLimit: 50 // 50ms between requests (1200/min limit)
    });
  }

  // Get all tickers or specific symbols
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      let endpoint = '/api/v3/ticker/24hr';
      let params = {};

      if (symbols.length > 0) {
        const binanceSymbols = symbols.map(s => this.normalizeSymbol(s));
        if (binanceSymbols.length === 1) {
          params.symbol = binanceSymbols[0];
        } else {
          params.symbols = JSON.stringify(binanceSymbols);
        }
      }

      const response = await this.client.get(endpoint, { params });
      const tickers = Array.isArray(response.data) ? response.data : [response.data];

      return tickers.map(ticker => this.standardizeTicker(ticker));
    } catch (error) {
      console.error(`Binance API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Binance: ${error.message}`);
    }
  }

  // Get order book for a symbol
  async getOrderBook(symbol, limit = 100) {
    try {
      await this.waitForRateLimit();

      const response = await this.client.get('/api/v3/depth', {
        params: {
          symbol: this.normalizeSymbol(symbol),
          limit
        }
      });

      return {
        symbol,
        exchange: this.name,
        bids: response.data.bids.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        asks: response.data.asks.map(([price, quantity]) => ({
          price: parseFloat(price),
          quantity: parseFloat(quantity)
        })),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`Binance order book error:`, error.message);
      throw error;
    }
  }

  // Get candlestick data
  async getKlines(symbol, interval = '1m', limit = 1000) {
    try {
      await this.waitForRateLimit();

      const response = await this.client.get('/api/v3/klines', {
        params: {
          symbol: this.normalizeSymbol(symbol),
          interval,
          limit
        }
      });

      return response.data.map(kline => ({
        symbol,
        exchange: this.name,
        timestamp: new Date(kline[0]),
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5]),
        closeTime: new Date(kline[6]),
        quoteVolume: parseFloat(kline[7]),
        trades: parseInt(kline[8])
      }));
    } catch (error) {
      console.error(`Binance klines error:`, error.message);
      throw error;
    }
  }

  // Normalize symbol: BTC/USDT -> BTCUSDT
  normalizeSymbol(symbol) {
    return symbol.replace('/', '').toUpperCase();
  }

  // Standardize Binance ticker format
  standardizeTicker(ticker) {
    return {
      symbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      volume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice),
      change: parseFloat(ticker.priceChange),
      changePercent: parseFloat(ticker.priceChangePercent),
      open: parseFloat(ticker.openPrice),
      bid: parseFloat(ticker.bidPrice),
      ask: parseFloat(ticker.askPrice),
      timestamp: parseInt(ticker.closeTime),
      exchange: this.name
    };
  }
}

module.exports = BinanceExchange;