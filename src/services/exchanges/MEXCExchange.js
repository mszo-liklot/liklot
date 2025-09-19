const BaseExchange = require('./BaseExchange');
const axios = require('axios');

class MEXCExchange extends BaseExchange {
  constructor() {
    super('mexc', 'https://api.mexc.com', 1200); // 1200 requests per minute
  }

  /**
   * MEXC API에서 티커 데이터 가져오기
   */
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/api/v3/ticker/24hr`, {
        timeout: 10000
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid API response structure');
      }

      const tickers = response.data;

      // 심볼 필터링 (요청된 심볼이 있는 경우)
      const filteredTickers = symbols.length > 0
        ? tickers.filter(ticker => symbols.includes(ticker.symbol))
        : tickers;

      return filteredTickers.map(ticker => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice) || 0,
        volume: parseFloat(ticker.volume) || 0,
        high: parseFloat(ticker.highPrice) || 0,
        low: parseFloat(ticker.lowPrice) || 0,
        changePercent: parseFloat(ticker.priceChangePercent) || 0,
        timestamp: Date.now(),
        exchange: this.name
      }));

    } catch (error) {
      console.error(`❌ MEXC API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * MEXC API에서 주문북 데이터 가져오기
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/api/v3/depth`, {
        params: {
          symbol: symbol,
          limit: limit
        },
        timeout: 10000
      });

      if (!response.data) {
        throw new Error('Invalid orderbook response');
      }

      return {
        symbol: symbol,
        bids: response.data.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: response.data.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: Date.now(),
        exchange: this.name
      };

    } catch (error) {
      console.error(`❌ MEXC orderbook error: ${error.message}`);
      throw error;
    }
  }

  /**
   * MEXC API에서 캔들스틱 데이터 가져오기
   */
  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      // MEXC interval 매핑
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d'
      };

      const mexcInterval = intervalMap[interval] || '1m';

      const response = await axios.get(`${this.baseURL}/api/v3/klines`, {
        params: {
          symbol: symbol,
          interval: mexcInterval,
          limit: limit
        },
        timeout: 10000
      });

      if (!Array.isArray(response.data)) {
        throw new Error('Invalid klines response');
      }

      return response.data.map(candle => ({
        openTime: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[6]),
        exchange: this.name,
        symbol: symbol
      }));

    } catch (error) {
      console.error(`❌ MEXC klines error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 거래소 상태 확인
   */
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/api/v3/exchangeInfo`, {
        timeout: 10000
      });

      if (!response.data || !Array.isArray(response.data.symbols)) {
        throw new Error('Invalid exchange info response');
      }

      const symbols = response.data.symbols;

      return {
        exchange: this.name,
        status: 'operational',
        totalPairs: symbols.length,
        activePairs: symbols.filter(symbol => symbol.status === 'TRADING').length,
        supportedAssets: [...new Set(symbols.map(symbol => symbol.baseAsset))].length,
        lastUpdate: Date.now()
      };

    } catch (error) {
      console.error(`❌ MEXC exchange info error: ${error.message}`);
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
      const response = await axios.get(`${this.baseURL}/api/v3/time`, {
        timeout: 5000
      });

      return {
        exchange: this.name,
        status: response.data.serverTime ? 'healthy' : 'unhealthy',
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

module.exports = MEXCExchange;