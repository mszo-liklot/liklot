const axios = require('axios');

class SymbolMappingService {
  constructor(dbConnection) {
    this.db = dbConnection;
    this.coinGeckoAPI = 'https://api.coingecko.com/api/v3';
    this.coinMarketCapAPI = 'https://pro-api.coinmarketcap.com/v1';
    this.cmcApiKey = process.env.COINMARKETCAP_API_KEY;

    // Rate limiting
    this.lastCoinGeckoCall = 0;
    this.lastCMCCall = 0;
    this.coinGeckoRateLimit = 1000; // 1초
    this.cmcRateLimit = 1000; // 1초
  }

  /**
   * 1. CoinGecko에서 모든 코인 목록과 거래소별 심볼 가져오기
   */
  async fetchCoinGeckoMappings() {
    try {
      await this.waitForRateLimit('coingecko');

      // 1단계: 모든 코인 목록 가져오기
      const coinsResponse = await axios.get(`${this.coinGeckoAPI}/coins/list`, {
        params: { include_platform: true }
      });

      console.log(`📊 CoinGecko: ${coinsResponse.data.length} coins fetched`);

      // 2단계: 각 거래소별 심볼 매핑 가져오기
      const exchangeMappings = await this.fetchExchangeMappings();

      return {
        coins: coinsResponse.data,
        exchangeMappings
      };

    } catch (error) {
      console.error('CoinGecko API error:', error.message);
      throw error;
    }
  }

  /**
   * 2. 거래소별 심볼 매핑 정보 수집
   */
  async fetchExchangeMappings() {
    const exchanges = ['binance', 'upbit', 'coinbase-exchange'];
    const mappings = {};

    for (const exchange of exchanges) {
      try {
        await this.waitForRateLimit('coingecko');

        const response = await axios.get(`${this.coinGeckoAPI}/exchanges/${exchange}/tickers`, {
          params: { page: 1, per_page: 100 }
        });

        mappings[exchange] = response.data.tickers.map(ticker => ({
          coinId: ticker.coin_id,
          baseSymbol: ticker.base,
          targetSymbol: ticker.target,
          exchangeSymbol: `${ticker.base}${ticker.target}`, // Binance 스타일
          market: ticker.market
        }));

        console.log(`📊 ${exchange}: ${mappings[exchange].length} symbols mapped`);

      } catch (error) {
        console.error(`❌ Failed to fetch ${exchange} mappings:`, error.message);
        mappings[exchange] = [];
      }
    }

    return mappings;
  }

  /**
   * 3. CoinMarketCap API로 추가 매핑 정보 보강
   */
  async fetchCoinMarketCapMappings() {
    if (!this.cmcApiKey) {
      console.warn('⚠️ CoinMarketCap API key not found, skipping...');
      return [];
    }

    try {
      await this.waitForRateLimit('cmc');

      const response = await axios.get(`${this.coinMarketCapAPI}/cryptocurrency/map`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.cmcApiKey
        },
        params: {
          listing_status: 'active',
          limit: 5000
        }
      });

      console.log(`📊 CoinMarketCap: ${response.data.data.length} coins fetched`);
      return response.data.data;

    } catch (error) {
      console.error('CoinMarketCap API error:', error.message);
      return [];
    }
  }

  /**
   * 4. 수집된 데이터를 데이터베이스에 저장
   */
  async saveMappingsToDatabase(coinGeckoData, cmcData) {
    const transaction = await this.db.beginTransaction();

    try {
      // 4-1. 코인 기본 정보 저장
      await this.saveCoinsInfo(coinGeckoData.coins, cmcData, transaction);

      // 4-2. 거래소별 심볼 매핑 저장
      await this.saveExchangeSymbols(coinGeckoData.exchangeMappings, transaction);

      // 4-3. 추가 매핑 정보 저장 (CMC ID 등)
      await this.saveCrossReferenceMappings(coinGeckoData.coins, cmcData, transaction);

      await transaction.commit();
      console.log('✅ Symbol mappings saved successfully');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Failed to save mappings:', error.message);
      throw error;
    }
  }

  /**
   * 5. 거래소 심볼 → 표준 ID 변환
   */
  async resolveSymbol(exchangeName, exchangeSymbol) {
    try {
      const query = `
        SELECT
          sm.coin_id,
          c.name,
          c.symbol as standard_symbol,
          c.coingecko_id,
          c.coinmarketcap_id
        FROM symbol_mappings sm
        JOIN coins c ON sm.coin_id = c.id
        WHERE sm.exchange_id = $1
          AND (sm.exchange_symbol = $2 OR sm.base_currency = $3)
        LIMIT 1
      `;

      // BTCUSDT → BTC 추출
      const baseSymbol = this.extractBaseSymbol(exchangeSymbol);

      const result = await this.db.query(query, [exchangeName, exchangeSymbol, baseSymbol]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // 매핑을 찾지 못한 경우 로그
      console.warn(`⚠️ Symbol not found: ${exchangeName}:${exchangeSymbol}`);
      return null;

    } catch (error) {
      console.error('Symbol resolution error:', error.message);
      return null;
    }
  }

  /**
   * 6. ETL 파이프라인에서 사용할 배치 심볼 변환
   */
  async resolveMultipleSymbols(exchangeName, symbols) {
    try {
      const placeholders = symbols.map((_, index) => `$${index + 2}`).join(',');
      const query = `
        SELECT
          sm.exchange_symbol,
          sm.coin_id,
          c.name,
          c.symbol as standard_symbol,
          c.coingecko_id
        FROM symbol_mappings sm
        JOIN coins c ON sm.coin_id = c.id
        WHERE sm.exchange_id = $1
          AND sm.exchange_symbol IN (${placeholders})
      `;

      const result = await this.db.query(query, [exchangeName, ...symbols]);

      // 매핑 객체 생성
      const mappingMap = {};
      result.rows.forEach(row => {
        mappingMap[row.exchange_symbol] = {
          coinId: row.coin_id,
          name: row.name,
          symbol: row.standard_symbol,
          coinGeckoId: row.coingecko_id
        };
      });

      return mappingMap;

    } catch (error) {
      console.error('Batch symbol resolution error:', error.message);
      return {};
    }
  }

  /**
   * 헬퍼 메서드들
   */
  async waitForRateLimit(api) {
    const now = Date.now();
    let lastCall, rateLimit;

    if (api === 'coingecko') {
      lastCall = this.lastCoinGeckoCall;
      rateLimit = this.coinGeckoRateLimit;
    } else {
      lastCall = this.lastCMCCall;
      rateLimit = this.cmcRateLimit;
    }

    const timeSinceLastCall = now - lastCall;
    if (timeSinceLastCall < rateLimit) {
      const waitTime = rateLimit - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    if (api === 'coingecko') {
      this.lastCoinGeckoCall = Date.now();
    } else {
      this.lastCMCCall = Date.now();
    }
  }

  extractBaseSymbol(exchangeSymbol) {
    // 일반적인 패턴들 처리
    const patterns = [
      /^(.+)USDT$/,    // BTCUSDT → BTC
      /^(.+)BTC$/,     // ETHBTC → ETH
      /^(.+)USD$/,     // ETHUSD → ETH
      /^KRW-(.+)$/,    // KRW-BTC → BTC (Upbit)
      /^(.+)-USD$/,    // BTC-USD → BTC (Coinbase)
      /^(.+)-EUR$/,    // BTC-EUR → BTC
    ];

    for (const pattern of patterns) {
      const match = exchangeSymbol.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return exchangeSymbol; // 패턴에 맞지 않으면 원본 반환
  }

  async saveCoinsInfo(coinGeckoCoins, cmcCoins, transaction) {
    // 구현 세부사항...
  }

  async saveExchangeSymbols(exchangeMappings, transaction) {
    // 구현 세부사항...
  }

  async saveCrossReferenceMappings(coinGeckoCoins, cmcCoins, transaction) {
    // 구현 세부사항...
  }

  /**
   * 매핑 데이터 업데이트 (일일 실행)
   */
  async updateMappings() {
    console.log('🔄 Starting symbol mapping update...');

    try {
      // 1. 외부 API에서 최신 데이터 수집
      const [coinGeckoData, cmcData] = await Promise.all([
        this.fetchCoinGeckoMappings(),
        this.fetchCoinMarketCapMappings()
      ]);

      // 2. 데이터베이스에 저장
      await this.saveMappingsToDatabase(coinGeckoData, cmcData);

      console.log('✅ Symbol mapping update completed');

    } catch (error) {
      console.error('❌ Symbol mapping update failed:', error.message);
      throw error;
    }
  }
}

module.exports = SymbolMappingService;