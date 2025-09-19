const BaseExchange = require('./BaseExchange');
const axios = require('axios');

class KrakenExchange extends BaseExchange {
  constructor() {
    super('kraken', 'https://api.kraken.com', 60); // 60 requests per minute (strict limit)
  }

  /**
   * Kraken API에서 티커 데이터 가져오기
   */
  async getTickers(symbols = []) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/0/public/Ticker`, {
        timeout: 10000
      });

      if (!response.data || response.data.error.length > 0) {
        throw new Error(`Kraken API error: ${response.data.error.join(', ')}`);
      }

      const tickers = response.data.result;
      const tickerArray = [];

      // Kraken의 특이한 응답 구조 처리
      Object.entries(tickers).forEach(([symbol, data]) => {
        // 심볼 필터링 (요청된 심볼이 있는 경우)
        if (symbols.length === 0 || symbols.includes(symbol)) {
          tickerArray.push({
            symbol: this.normalizeKrakenSymbol(symbol),
            price: parseFloat(data.c[0]) || 0, // last trade closed array
            volume: parseFloat(data.v[1]) || 0, // volume last 24 hours
            high: parseFloat(data.h[1]) || 0, // high last 24 hours
            low: parseFloat(data.l[1]) || 0, // low last 24 hours
            changePercent: ((parseFloat(data.c[0]) - parseFloat(data.o)) / parseFloat(data.o)) * 100 || 0,
            timestamp: Date.now(),
            exchange: this.name
          });
        }
      });

      return tickerArray;

    } catch (error) {
      console.error(`❌ Kraken API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kraken 심볼 정규화 (XXBTZUSD → BTCUSD)
   */
  normalizeKrakenSymbol(krakenSymbol) {
    const symbolMap = {
      'XXBTZUSD': 'BTCUSD',
      'XETHZUSD': 'ETHUSD',
      'XXBTZEUR': 'BTCEUR',
      'XETHZEUR': 'ETHEUR',
      'ADAUSD': 'ADAUSD',
      'ADAEUR': 'ADAEUR',
      'DOTUSD': 'DOTUSD',
      'DOTEUR': 'DOTEUR',
      'SOLUSD': 'SOLUSD',
      'SOLEUR': 'SOLEUR'
    };

    return symbolMap[krakenSymbol] || krakenSymbol;
  }

  /**
   * Kraken API에서 주문북 데이터 가져오기
   */
  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const response = await axios.get(`${this.baseURL}/0/public/Depth`, {
        params: {
          pair: symbol,
          count: limit
        },
        timeout: 10000
      });

      if (!response.data || response.data.error.length > 0) {
        throw new Error(`Kraken orderbook error: ${response.data.error.join(', ')}`);
      }

      const pairData = Object.values(response.data.result)[0];

      return {
        symbol: symbol,
        bids: pairData.bids.map(bid => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: pairData.asks.map(ask => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: Date.now(),
        exchange: this.name
      };

    } catch (error) {
      console.error(`❌ Kraken orderbook error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kraken API에서 캔들스틱 데이터 가져오기
   */
  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      // Kraken interval 매핑 (분 단위)
      const intervalMap = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '1h': 60,
        '4h': 240,
        '1d': 1440
      };

      const krakenInterval = intervalMap[interval] || 1;

      const response = await axios.get(`${this.baseURL}/0/public/OHLC`, {
        params: {
          pair: symbol,
          interval: krakenInterval
        },
        timeout: 10000
      });

      if (!response.data || response.data.error.length > 0) {
        throw new Error(`Kraken klines error: ${response.data.error.join(', ')}`);
      }

      const pairData = Object.values(response.data.result)[0];

      return pairData.slice(-limit).map(candle => ({
        openTime: parseInt(candle[0]) * 1000,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[6]),
        closeTime: parseInt(candle[0]) * 1000 + this.getIntervalMs(interval) - 1,
        exchange: this.name,
        symbol: symbol
      }));

    } catch (error) {
      console.error(`❌ Kraken klines error: ${error.message}`);
      throw error;
    }
  }

  /**
   * 거래소 상태 확인
   */
  async getExchangeInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/0/public/AssetPairs`, {
        timeout: 10000
      });

      if (!response.data || response.data.error.length > 0) {
        throw new Error(`Kraken exchange info error: ${response.data.error.join(', ')}`);
      }

      const pairs = Object.keys(response.data.result);

      return {
        exchange: this.name,
        status: 'operational',
        totalPairs: pairs.length,
        activePairs: pairs.length, // Kraken doesn't provide status per pair
        supportedAssets: [...new Set(pairs.map(pair => pair.substring(0, 3)))].length,
        lastUpdate: Date.now()
      };

    } catch (error) {
      console.error(`❌ Kraken exchange info error: ${error.message}`);
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
      const response = await axios.get(`${this.baseURL}/0/public/Time`, {
        timeout: 5000
      });

      return {
        exchange: this.name,
        status: response.data.error.length === 0 ? 'healthy' : 'unhealthy',
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

module.exports = KrakenExchange;