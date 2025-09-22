const BaseExchange = require('./BaseExchange');

class UpbitExchange extends BaseExchange {
  constructor() {
    super({
      name: 'upbit',
      baseURL: 'https://api.upbit.com/v1',
      rateLimit: 100 // 100ms between requests (600/min limit)
    });
  }

  async getTickers(symbols = null) {
    try {
      await this.waitForRateLimit();

      let url = '/ticker';

      // Upbit은 모든 마켓 정보를 먼저 가져와야 함
      const marketsResponse = await this.makeRequest('/market/all');
      const markets = marketsResponse.filter(market =>
        market.market.startsWith('KRW-') || market.market.startsWith('BTC-') || market.market.startsWith('USDT-')
      );

      // 심볼 필터링
      let targetMarkets = markets;
      if (symbols && symbols.length > 0) {
        const upbitSymbols = symbols.map(s => this.normalizeSymbolForUpbit(s));
        targetMarkets = markets.filter(market =>
          upbitSymbols.includes(market.market)
        );
      }

      if (targetMarkets.length === 0) {
        return [];
      }

      // markets 파라미터로 티커 조회
      const marketsList = targetMarkets.map(m => m.market).join(',');
      url += `?markets=${marketsList}`;

      const data = await this.makeRequest(url);

      return data.map(ticker => this.standardizeTicker(ticker));

    } catch (error) {
      console.error('Upbit API error:', error.message);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const upbitSymbol = this.normalizeSymbolForUpbit(symbol);
      const url = `/orderbook?markets=${upbitSymbol}`;

      const data = await this.makeRequest(url);

      if (!data || data.length === 0) {
        throw new Error(`No orderbook data for ${symbol}`);
      }

      const orderbook = data[0];

      return {
        symbol: symbol,
        bids: orderbook.orderbook_units.map(unit => ({
          price: parseFloat(unit.bid_price),
          amount: parseFloat(unit.bid_size)
        })).slice(0, limit),
        asks: orderbook.orderbook_units.map(unit => ({
          price: parseFloat(unit.ask_price),
          amount: parseFloat(unit.ask_size)
        })).slice(0, limit),
        timestamp: new Date(orderbook.timestamp).getTime()
      };

    } catch (error) {
      console.error(`Upbit orderbook error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      const upbitSymbol = this.normalizeSymbolForUpbit(symbol);
      const upbitInterval = this.normalizeInterval(interval);

      const url = `/candles/${upbitInterval}?market=${upbitSymbol}&count=${limit}`;

      const data = await this.makeRequest(url);

      return data.reverse().map(candle => ({
        openTime: new Date(candle.candle_date_time_kst).getTime(),
        open: parseFloat(candle.opening_price),
        high: parseFloat(candle.high_price),
        low: parseFloat(candle.low_price),
        close: parseFloat(candle.trade_price),
        volume: parseFloat(candle.candle_acc_trade_volume),
        closeTime: new Date(candle.candle_date_time_kst).getTime() + this.getIntervalMs(interval) - 1,
        quoteVolume: parseFloat(candle.candle_acc_trade_price),
        trades: 0,
        baseAssetVolume: parseFloat(candle.candle_acc_trade_volume),
        quoteAssetVolume: parseFloat(candle.candle_acc_trade_price)
      }));

    } catch (error) {
      console.error(`Upbit klines error for ${symbol}:`, error.message);
      throw error;
    }
  }

  standardizeTicker(ticker) {
    return {
      symbol: this.denormalizeSymbol(ticker.market),
      price: parseFloat(ticker.trade_price),
      high: parseFloat(ticker.high_price),
      low: parseFloat(ticker.low_price),
      volume: parseFloat(ticker.acc_trade_volume_24h),
      quoteVolume: parseFloat(ticker.acc_trade_price_24h),
      open: parseFloat(ticker.opening_price),
      change: parseFloat(ticker.change_price),
      changePercent: parseFloat(ticker.change_rate) * 100,
      bid: parseFloat(ticker.trade_price), // Upbit doesn't provide bid/ask in ticker
      ask: parseFloat(ticker.trade_price),
      timestamp: new Date(ticker.trade_date + 'T' + ticker.trade_time + '+09:00').getTime()
    };
  }

  normalizeSymbolForUpbit(symbol) {
    // BTC/USDT → KRW-BTC (기본적으로 KRW 마켓 사용)
    // BTCUSDT → KRW-BTC
    if (symbol.includes('/')) {
      const [base, quote] = symbol.split('/');
      return `KRW-${base}`;
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `KRW-${base}`;
    } else if (symbol.endsWith('KRW')) {
      const base = symbol.replace('KRW', '');
      return `KRW-${base}`;
    }

    // 이미 Upbit 형식인 경우
    if (symbol.includes('-')) {
      return symbol;
    }

    return `KRW-${symbol}`;
  }

  denormalizeSymbol(upbitSymbol) {
    // KRW-BTC → BTC/KRW
    if (upbitSymbol.includes('-')) {
      const [quote, base] = upbitSymbol.split('-');
      return `${base}/${quote}`;
    }
    return upbitSymbol;
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 'minutes/1',
      '3m': 'minutes/3',
      '5m': 'minutes/5',
      '15m': 'minutes/15',
      '30m': 'minutes/30',
      '1h': 'minutes/60',
      '4h': 'minutes/240',
      '1d': 'days',
      '1w': 'weeks',
      '1M': 'months'
    };

    return intervalMap[interval] || 'minutes/1';
  }

  getIntervalMs(interval) {
    const intervalMs = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };

    return intervalMs[interval] || 60 * 1000;
  }
}

module.exports = UpbitExchange;