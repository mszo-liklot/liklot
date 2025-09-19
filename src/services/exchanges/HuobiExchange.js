const BaseExchange = require('./BaseExchange');
const axios = require('axios');

class HuobiExchange extends BaseExchange {
  constructor() {
    super('huobi', 'https://api.huobi.pro', 800); // 800 requests per minute
  }

  /**
   * Huobi API에서 티커 데이터 가져오기
   */
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/market/tickers`, {
        timeout: 10000
      });

      if (!response.data || response.data.status !== 'ok' || !Array.isArray(response.data.data)) {
        throw new Error('Invalid API response structure');
      }

      const tickers = response.data.data;

      // 심볼 필터링 (요청된 심볼이 있는 경우)
      const filteredTickers = symbols.length > 0
        ? tickers.filter(ticker => symbols.includes(ticker.symbol.toUpperCase()))
        : tickers;

      return filteredTickers.map(ticker => ({
        symbol: ticker.symbol.toUpperCase(),
        price: parseFloat(ticker.close) || 0,
        volume: parseFloat(ticker.vol) || 0,
        high: parseFloat(ticker.high) || 0,
        low: parseFloat(ticker.low) || 0,
        changePercent: ((parseFloat(ticker.close) - parseFloat(ticker.open)) / parseFloat(ticker.open)) * 100 || 0,
        timestamp: Date.now(),
        exchange: this.name
      }));

    } catch (error) {
      console.error(`❌ Huobi API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Huobi API에서 주문북 데이터 가져오기
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/market/depth`, {
        params: {
          symbol: symbol.toLowerCase(),
          depth: limit,
          type: 'step0'
        },
        timeout: 10000
      });

      if (!response.data || response.data.status !== 'ok') {
        throw new Error('Invalid orderbook response');
      }

      const orderbook = response.data.tick;

      return {
        symbol: symbol,
        bids: orderbook.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: orderbook.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: Date.now(),
        exchange: this.name
      };

    } catch (error) {
      console.error(`❌ Huobi orderbook error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Huobi API에서 캔들스틱 데이터 가져오기
   */
  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      // Huobi interval 매핑
      const intervalMap = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '1h': '60min',
        '4h': '4hour',
        '1d': '1day'
      };

      const huobiInterval = intervalMap[interval] || '1min';

      const response = await axios.get(`${this.baseURL}/market/history/kline`, {
        params: {
          symbol: symbol.toLowerCase(),
          period: huobiInterval,
          size: limit
        },
        timeout: 10000
      });

      if (!response.data || response.data.status !== 'ok' || !Array.isArray(response.data.data)) {
        throw new Error('Invalid klines response');
      }

      return response.data.data.map(candle => ({
        openTime: candle.id * 1000,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.vol),
        closeTime: candle.id * 1000 + this.getIntervalMs(interval) - 1,
        exchange: this.name,
        symbol: symbol
      }));

    } catch (error) {
      console.error(`❌ Huobi klines error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 거래소 상태 확인
   */
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/v1/common/symbols`, {
        timeout: 10000
      });

      if (!response.data || response.data.status !== 'ok' || !Array.isArray(response.data.data)) {
        throw new Error('Invalid exchange info response');
      }

      const symbols = response.data.data;

      return {
        exchange: this.name,
        status: 'operational',
        totalPairs: symbols.length,
        activePairs: symbols.filter(symbol => symbol.state === 'online').length,
        supportedAssets: [...new Set(symbols.map(symbol => symbol['base-currency']))].length,
        lastUpdate: Date.now()
      };

    } catch (error) {
      console.error(`❌ Huobi exchange info error: ${error.message}`);
      return {
        exchange: this.name,
        status: 'error',
        error: error.message,
        lastUpdate: Date.now()
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.baseURL}/v1/common/timestamp`, {
        timeout: 5000
      });

      return {
        exchange: this.name,
        status: response.data.status === 'ok' ? 'healthy' : 'unhealthy',
        latency: Date.now() - startTime,
        timestamp: Date.now()
      };

    } catch (error) {
      return {
        exchange: this.name,
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

module.exports = HuobiExchange;