const BaseExchange = require('./BaseExchange');

class KuCoinExchange extends BaseExchange {
  constructor() {
    super({
      name: 'kucoin',
      baseURL: 'https://api.kucoin.com/api/v1',
      rateLimit: 33 // 33ms between requests (1800/min limit)
    });
  }

  async getTickers(symbols = null) {
    try {
      await this.waitForRateLimit();

      let url = '/market/allTickers';

      const data = await this.makeRequest(url);

      if (data.code !== '200000') {
        throw new Error(`KuCoin API error: ${data.msg}`);
      }

      let tickers = data.data.ticker;

      // 심볼 필터링
      if (symbols && symbols.length > 0) {
        const kucoinSymbols = symbols.map(s => this.normalizeSymbolForKuCoin(s));
        tickers = tickers.filter(ticker =>
          kucoinSymbols.includes(ticker.symbol)
        );
      }

      // USDT, BTC, ETH 주요 마켓만 필터링
      tickers = tickers.filter(ticker =>
        ticker.symbol.endsWith('-USDT') ||
        ticker.symbol.endsWith('-BTC') ||
        ticker.symbol.endsWith('-ETH') ||
        ticker.symbol.endsWith('-KCS')
      );

      return tickers.map(ticker => this.standardizeTicker(ticker));

    } catch (error) {
      console.error('KuCoin API error:', error.message);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const kucoinSymbol = this.normalizeSymbolForKuCoin(symbol);
      const url = `/market/orderbook/level2_${limit}?symbol=${kucoinSymbol}`;

      const data = await this.makeRequest(url);

      if (data.code !== '200000') {
        throw new Error(`KuCoin orderbook error: ${data.msg}`);
      }

      const orderbook = data.data;

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
        timestamp: parseInt(orderbook.time)
      };

    } catch (error) {
      console.error(`KuCoin orderbook error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      const kucoinSymbol = this.normalizeSymbolForKuCoin(symbol);
      const kucoinInterval = this.normalizeInterval(interval);

      const endAt = Math.floor(Date.now() / 1000);
      const startAt = endAt - (limit * this.getIntervalSeconds(interval));

      const url = `/market/candles?type=${kucoinInterval}&symbol=${kucoinSymbol}&startAt=${startAt}&endAt=${endAt}`;

      const data = await this.makeRequest(url);

      if (data.code !== '200000') {
        throw new Error(`KuCoin klines error: ${data.msg}`);
      }

      return data.data.reverse().map(candle => ({
        openTime: parseInt(candle[0]) * 1000,
        open: parseFloat(candle[1]),
        close: parseFloat(candle[2]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: (parseInt(candle[0]) + this.getIntervalSeconds(interval)) * 1000 - 1,
        quoteVolume: parseFloat(candle[6]),
        trades: 0,
        baseAssetVolume: parseFloat(candle[5]),
        quoteAssetVolume: parseFloat(candle[6])
      }));

    } catch (error) {
      console.error(`KuCoin klines error for ${symbol}:`, error.message);
      throw error;
    }
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const change = parseFloat(ticker.changePrice);
    const changePercent = parseFloat(ticker.changeRate) * 100;

    return {
      symbol: this.denormalizeSymbol(ticker.symbol),
      price: price,
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      volume: parseFloat(ticker.vol),
      quoteVolume: parseFloat(ticker.volValue),
      open: price - change,
      change: change,
      changePercent: changePercent,
      bid: parseFloat(ticker.buy || price),
      ask: parseFloat(ticker.sell || price),
      timestamp: parseInt(ticker.time)
    };
  }

  normalizeSymbolForKuCoin(symbol) {
    // BTC/USDT → BTC-USDT
    // BTCUSDT → BTC-USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '-');
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}-USDT`;
    } else if (symbol.endsWith('BTC')) {
      const base = symbol.replace('BTC', '');
      return `${base}-BTC`;
    } else if (symbol.endsWith('ETH')) {
      const base = symbol.replace('ETH', '');
      return `${base}-ETH`;
    }

    // 이미 KuCoin 형식인 경우
    if (symbol.includes('-')) {
      return symbol;
    }

    return `${symbol}-USDT`;
  }

  denormalizeSymbol(kucoinSymbol) {
    // BTC-USDT → BTC/USDT
    return kucoinSymbol.replace('-', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': '1min',
      '3m': '3min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1hour',
      '2h': '2hour',
      '4h': '4hour',
      '6h': '6hour',
      '8h': '8hour',
      '12h': '12hour',
      '1d': '1day',
      '1w': '1week'
    };

    return intervalMap[interval] || '1min';
  }

  getIntervalSeconds(interval) {
    const intervalSeconds = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400,
      '1w': 604800
    };

    return intervalSeconds[interval] || 60;
  }
}

module.exports = KuCoinExchange;