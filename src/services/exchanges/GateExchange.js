const BaseExchange = require('./BaseExchange');
const axios = require('axios');

class GateExchange extends BaseExchange {
  constructor() {
    super('gate', 'https://api.gateio.ws', 900); // 900 requests per minute
  }

  /**
   * Gate.io API에서 티커 데이터 가져오기
   */
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/api/v4/spot/tickers`, {
        timeout: 10000
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid API response structure');
      }

      const tickers = response.data;

      // 심볼 필터링 (요청된 심볼이 있는 경우)
      const filteredTickers = symbols.length > 0
        ? tickers.filter(ticker => symbols.includes(ticker.currency_pair))
        : tickers;

      return filteredTickers.map(ticker => ({
        symbol: ticker.currency_pair,
        price: parseFloat(ticker.last) || 0,
        volume: parseFloat(ticker.base_volume) || 0,
        high: parseFloat(ticker.high_24h) || 0,
        low: parseFloat(ticker.low_24h) || 0,
        changePercent: parseFloat(ticker.change_percentage) || 0,
        timestamp: Date.now(),
        exchange: this.name
      }));

    } catch (error) {
      console.error(`❌ Gate.io API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gate.io API에서 주문북 데이터 가져오기
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/api/v4/spot/order_book`, {
        params: {
          currency_pair: symbol,
          limit: limit
        },
        timeout: 10000
      });

      if (!response.data) {
        throw new Error('Invalid orderbook response');
      }

      const orderbook = response.data;

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
      console.error(`❌ Gate.io orderbook error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gate.io API에서 캔들스틱 데이터 가져오기
   */
  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      // Gate.io interval 매핑
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d'
      };

      const gateInterval = intervalMap[interval] || '1m';

      const response = await axios.get(`${this.baseURL}/api/v4/spot/candlesticks`, {
        params: {
          currency_pair: symbol,
          interval: gateInterval,
          limit: limit
        },
        timeout: 10000
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid klines response');
      }

      return response.data.map(candle => ({
        openTime: parseInt(candle[0]) * 1000,
        open: parseFloat(candle[5]),
        high: parseFloat(candle[3]),
        low: parseFloat(candle[4]),
        close: parseFloat(candle[2]),
        volume: parseFloat(candle[1]),
        closeTime: parseInt(candle[0]) * 1000 + this.getIntervalMs(interval) - 1,
        exchange: this.name,
        symbol: symbol
      }));

    } catch (error) {
      console.error(`❌ Gate.io klines error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 거래소 상태 확인
   */
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/api/v4/spot/currency_pairs`, {
        timeout: 10000
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid exchange info response');
      }

      const pairs = response.data;

      return {
        exchange: this.name,
        status: 'operational',
        totalPairs: pairs.length,
        activePairs: pairs.filter(pair => pair.trade_status === 'tradable').length,
        supportedAssets: [...new Set(pairs.map(pair => pair.base))].length,
        lastUpdate: Date.now()
      };

    } catch (error) {
      console.error(`❌ Gate.io exchange info error: ${error.message}`);
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
      const response = await axios.get(`${this.baseURL}/api/v4/spot/time`, {
        timeout: 5000
      });

      return {
        exchange: this.name,
        status: response.data ? 'healthy' : 'unhealthy',
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

module.exports = GateExchange;