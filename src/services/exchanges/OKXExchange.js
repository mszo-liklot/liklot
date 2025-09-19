const BaseExchange = require('./BaseExchange');

class OKXExchange extends BaseExchange {
  constructor() {
    super('okx', 'https://www.okx.com/api/v5', 1200); // 1200 calls per minute
  }

  async getTickers(symbols = null) {
    try {
      await this.waitForRateLimit();

      let url = '/market/tickers?instType=SPOT';

      const data = await this.makeRequest(url);

      if (data.code !== '0') {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      let tickers = data.data;

      // 심볼 필터링
      if (symbols && symbols.length > 0) {
        const okxSymbols = symbols.map(s => this.normalizeSymbolForOKX(s));
        tickers = tickers.filter(ticker =>
          okxSymbols.includes(ticker.instId)
        );
      }

      // 주요 마켓만 필터링 (USDT, BTC, ETH)
      tickers = tickers.filter(ticker =>
        ticker.instId.endsWith('-USDT') ||
        ticker.instId.endsWith('-BTC') ||
        ticker.instId.endsWith('-ETH') ||
        ticker.instId.endsWith('-USDC')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));

    } catch (error) {
      console.error('OKX API error:', error.message);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const okxSymbol = this.normalizeSymbolForOKX(symbol);
      const url = `/market/books?instId=${okxSymbol}&sz=${limit}`;

      const data = await this.makeRequest(url);

      if (data.code !== '0') {
        throw new Error(`OKX orderbook error: ${data.msg}`);
      }

      const orderbook = data.data[0];

      return {
        symbol: symbol,
        bids: orderbook.bids.map(bid => ({
          price: parseFloat(bid[0]),
          amount: parseFloat(bid[1])
        })),
        asks: orderbook.asks.map(ask => ({
          price: parseFloat(ask[0]),
          amount: parseFloat(ask[1])
        })),
        timestamp: parseInt(orderbook.ts)
      };

    } catch (error) {
      console.error(`OKX orderbook error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      const okxSymbol = this.normalizeSymbolForOKX(symbol);
      const okxInterval = this.normalizeInterval(interval);

      // OKX는 최대 100개까지만 지원
      const actualLimit = Math.min(limit, 100);

      const url = `/market/candles?instId=${okxSymbol}&bar=${okxInterval}&limit=${actualLimit}`;

      const data = await this.makeRequest(url);

      if (data.code !== '0') {
        throw new Error(`OKX klines error: ${data.msg}`);
      }

      return data.data.reverse().map(candle => ({
        openTime: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[0]) + this.getIntervalMs(interval) - 1,
        quoteVolume: parseFloat(candle[7]),
        trades: 0,
        baseAssetVolume: parseFloat(candle[5]),
        quoteAssetVolume: parseFloat(candle[7])
      }));

    } catch (error) {
      console.error(`OKX klines error for ${symbol}:`, error.message);
      throw error;
    }
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const open = parseFloat(ticker.open24h);
    const change = price - open;
    const changePercent = open > 0 ? (change / open) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.instId),
      price: price,
      high: parseFloat(ticker.high24h),
      low: parseFloat(ticker.low24h),
      volume: parseFloat(ticker.vol24h),
      quoteVolume: parseFloat(ticker.volCcy24h),
      open: open,
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.bidPx || price),
      ask: parseFloat(ticker.askPx || price),
      timestamp: parseInt(ticker.ts)
    };
  }

  normalizeSymbolForOKX(symbol) {
    // BTC/USDT → BTC-USDT
    // BTCUSDT → BTC-USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '-');
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}-USDT`;
    } else if (symbol.endsWith('USDC')) {
      const base = symbol.replace('USDC', '');
      return `${base}-USDC`;
    } else if (symbol.endsWith('BTC')) {
      const base = symbol.replace('BTC', '');
      return `${base}-BTC`;
    } else if (symbol.endsWith('ETH')) {
      const base = symbol.replace('ETH', '');
      return `${base}-ETH`;
    }

    // 이미 OKX 형식인 경우
    if (symbol.includes('-')) {
      return symbol;
    }

    return `${symbol}-USDT`;
  }

  denormalizeSymbol(okxSymbol) {
    // BTC-USDT → BTC/USDT
    return okxSymbol.replace('-', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1m',
      '3m': '3m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1H',
      '2h': '2H',
      '4h': '4H',
      '6h': '6H',
      '12h': '12H',
      '1d': '1D',
      '1w': '1W',
      '1M': '1M'
    };

    return intervalMap[interval] || '1m';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };

    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = OKXExchange;