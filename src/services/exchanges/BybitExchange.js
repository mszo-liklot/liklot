const BaseExchange = require('./BaseExchange');
const axios = require('axios');

class BybitExchange extends BaseExchange {
  constructor() {
    super('bybit', 'https://api.bybit.com', 600); // 600 requests per minute
  }

  /**
   * Bybit API에서 티커 데이터 가져오기
   */
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      // Bybit v5 API 사용
      const response = await axios.get(`${this.baseURL}/v5/market/tickers`, {
        params: {
          category: 'spot' // spot 거래만
        },
        timeout: 10000
      });

      if (!response.data || !response.data.result || !response.data.result.list) {
        throw new Error('Invalid API response structure');
      }

      const tickers = response.data.result.list;

      // 심볼 필터링 (요청된 심볼이 있는 경우)
      const filteredTickers = symbols.length > 0
        ? tickers.filter(ticker => symbols.includes(ticker.symbol))
        : tickers;

      return filteredTickers.map(ticker => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice) || 0,
        volume: parseFloat(ticker.volume24h) || 0,
        high: parseFloat(ticker.highPrice24h) || 0,
        low: parseFloat(ticker.lowPrice24h) || 0,
        changePercent: parseFloat(ticker.price24hPcnt) * 100 || 0,
        timestamp: Date.now(),
        exchange: this.name
      }));

    } catch (error) {
      console.error(`❌ Bybit API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bybit API에서 주문북 데이터 가져오기
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/v5/market/orderbook`, {
        params: {
          category: 'spot',
          symbol: symbol,
          limit: limit
        },
        timeout: 10000
      });

      if (!response.data || !response.data.result) {
        throw new Error('Invalid orderbook response');
      }

      const orderbook = response.data.result;

      return {
        symbol: symbol,
        bids: orderbook.b.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: orderbook.a.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: Date.now(),
        exchange: this.name
      };

    } catch (error) {
      console.error(`❌ Bybit orderbook error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bybit API에서 캔들스틱 데이터 가져오기
   */
  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      // Bybit interval 매핑
      const intervalMap = {
        '1m': '1',
        '5m': '5',
        '15m': '15',
        '1h': '60',
        '4h': '240',
        '1d': 'D'
      };

      const bybitInterval = intervalMap[interval] || '1';

      const response = await axios.get(`${this.baseURL}/v5/market/kline`, {
        params: {
          category: 'spot',
          symbol: symbol,
          interval: bybitInterval,
          limit: limit
        },
        timeout: 10000
      });

      if (!response.data || !response.data.result || !response.data.result.list) {
        throw new Error('Invalid klines response');
      }

      return response.data.result.list.map(candle => ({
        openTime: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[0]) + this.getIntervalMs(interval) - 1,
        exchange: this.name,
        symbol: symbol
      }));

    } catch (error) {
      console.error(`❌ Bybit klines error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 거래소 상태 확인
   */
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/v5/market/instruments-info`, {
        params: {
          category: 'spot'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.result) {
        throw new Error('Invalid exchange info response');
      }

      const instruments = response.data.result.list;

      return {
        exchange: this.name,
        status: 'operational',
        totalPairs: instruments.length,
        activePairs: instruments.filter(inst => inst.status === 'Trading').length,
        supportedAssets: [...new Set(instruments.map(inst => inst.baseCoin))].length,
        lastUpdate: Date.now()
      };

    } catch (error) {
      console.error(`❌ Bybit exchange info error: ${error.message}`);
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
      const response = await axios.get(`${this.baseURL}/v5/market/time`, {
        timeout: 5000
      });

      return {
        exchange: this.name,
        status: response.data.retCode === 0 ? 'healthy' : 'unhealthy',
        latency: Date.now() - parseInt(response.data.time),
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

module.exports = BybitExchange;