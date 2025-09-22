const BaseExchange = require('./BaseExchange');

class BithumbExchange extends BaseExchange {
  constructor() {
    super({
      name: 'bithumb',
      baseURL: 'https://api.bithumb.com/public',
      rateLimit: 67 // 67ms between requests (900/min limit)
    });
  }

  async getTickers(symbols = null) {
    try {
      await this.waitForRateLimit();

      let url = '/ticker/ALL_KRW';

      const data = await this.makeRequest(url);

      if (data.status !== '0000') {
        throw new Error(`Bithumb API error: ${data.message}`);
      }

      const tickers = [];
      const tickerData = data.data;

      for (const [symbol, ticker] of Object.entries(tickerData)) {
        if (symbol === 'date') continue;

        // 심볼 필터링
        if (symbols && symbols.length > 0) {
          const normalizedSymbols = symbols.map(s => this.normalizeSymbolForBithumb(s));
          if (!normalizedSymbols.includes(symbol)) {
            continue;
          }
        }

        tickers.push(this.standardizeTicker({
          symbol: symbol,
          ...ticker,
          timestamp: tickerData.date
        }));
      }

      return tickers;

    } catch (error) {
      console.error('Bithumb API error:', error.message);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const bithumbSymbol = this.normalizeSymbolForBithumb(symbol);
      const url = `/orderbook/${bithumbSymbol}_KRW?count=${limit}`;

      const data = await this.makeRequest(url);

      if (data.status !== '0000') {
        throw new Error(`Bithumb orderbook error: ${data.message}`);
      }

      const orderbook = data.data;

      return {
        symbol: symbol,
        bids: orderbook.bids.map(bid => ({
          price: parseFloat(bid.price),
          amount: parseFloat(bid.quantity)
        })),
        asks: orderbook.asks.map(ask => ({
          price: parseFloat(ask.price),
          amount: parseFloat(ask.quantity)
        })),
        timestamp: parseInt(orderbook.timestamp)
      };

    } catch (error) {
      console.error(`Bithumb orderbook error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      const bithumbSymbol = this.normalizeSymbolForBithumb(symbol);
      const bithumbInterval = this.normalizeInterval(interval);

      const url = `/candlestick/${bithumbSymbol}_KRW/${bithumbInterval}`;

      const data = await this.makeRequest(url);

      if (data.status !== '0000') {
        throw new Error(`Bithumb klines error: ${data.message}`);
      }

      return data.data.slice(0, limit).map(candle => ({
        openTime: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        close: parseFloat(candle[2]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[0]) + this.getIntervalMs(interval) - 1,
        quoteVolume: parseFloat(candle[5]) * parseFloat(candle[2]),
        trades: 0,
        baseAssetVolume: parseFloat(candle[5]),
        quoteAssetVolume: parseFloat(candle[5]) * parseFloat(candle[2])
      }));

    } catch (error) {
      console.error(`Bithumb klines error for ${symbol}:`, error.message);
      throw error;
    }
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.closing_price);
    const open = parseFloat(ticker.opening_price);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      high: parseFloat(ticker.max_price),
      low: parseFloat(ticker.min_price),
      volume: parseFloat(ticker.units_traded_24H),
      quoteVolume: parseFloat(ticker.acc_trade_value_24H),
      open: open,
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.buy_price || price),
      ask: parseFloat(ticker.sell_price || price),
      timestamp: parseInt(ticker.timestamp)
    };
  }

  normalizeSymbolForBithumb(symbol) {
    // BTC/KRW → BTC
    // BTCKRW → BTC
    if (symbol.includes('/')) {
      const [base] = symbol.split('/');
      return base.toUpperCase();
    } else if (symbol.endsWith('KRW')) {
      return symbol.replace('KRW', '').toUpperCase();
    } else if (symbol.endsWith('USDT')) {
      // Bithumb은 주로 KRW 마켓이므로 USDT는 제거하고 기본 심볼만 사용
      return symbol.replace('USDT', '').toUpperCase();
    }

    return symbol.toUpperCase();
  }

  denormalizeSymbol(bithumbSymbol) {
    // BTC → BTC/KRW
    return `${bithumbSymbol}/KRW`;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '10m': '10m',
      '30m': '30m',
      '1h': '1h',
      '6h': '6h',
      '12h': '12h',
      '1d': '24h'
    };

    return intervalMap[interval] || '1m';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '10m': 10 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = BithumbExchange;