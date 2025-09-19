const ExchangeManager = require('./ExchangeManager');
const SymbolMappingService = require('./SymbolMappingService');

class ETLPipeline {
  constructor(dbConnection, clickhouseConnection, redisConnection) {
    this.db = dbConnection;
    this.clickhouse = clickhouseConnection;
    this.redis = redisConnection;

    this.exchangeManager = new ExchangeManager();
    this.symbolMapper = new SymbolMappingService(dbConnection);

    this.batchSize = 1000;
    this.processingQueue = [];
  }

  /**
   * 메인 ETL 프로세스
   * Extract → Transform → Load with Symbol Resolution
   */
  async runETL() {
    console.log('🔄 Starting ETL pipeline...');

    try {
      // 1. Extract: 모든 거래소에서 데이터 수집
      const rawData = await this.extractData();

      // 2. Transform: 심볼 해결 및 데이터 정규화
      const transformedData = await this.transformData(rawData);

      // 3. Load: ClickHouse 및 Redis에 저장
      await this.loadData(transformedData);

      console.log('✅ ETL pipeline completed successfully');

    } catch (error) {
      console.error('❌ ETL pipeline failed:', error.message);
      throw error;
    }
  }

  /**
   * 1. Extract Phase: 거래소에서 원시 데이터 수집
   */
  async extractData() {
    console.log('📥 Extracting data from exchanges...');

    const exchangeData = new Map();
    const activeExchanges = this.exchangeManager.getActiveExchanges();

    for (const exchangeName of activeExchanges) {
      try {
        const exchange = this.exchangeManager.getExchange(exchangeName);

        // 모든 티커 데이터 가져오기
        const tickers = await exchange.getTickers();

        exchangeData.set(exchangeName, {
          exchange: exchangeName,
          timestamp: Date.now(),
          tickers: tickers,
          count: tickers.length
        });

        console.log(`📊 ${exchangeName}: ${tickers.length} tickers extracted`);

      } catch (error) {
        console.error(`❌ Failed to extract from ${exchangeName}:`, error.message);
        exchangeData.set(exchangeName, {
          exchange: exchangeName,
          timestamp: Date.now(),
          tickers: [],
          error: error.message
        });
      }
    }

    return exchangeData;
  }

  /**
   * 2. Transform Phase: 심볼 해결 및 데이터 정규화
   */
  async transformData(rawData) {
    console.log('🔄 Transforming data with symbol resolution...');

    const transformedData = [];
    let totalProcessed = 0;
    let totalResolved = 0;

    for (const [exchangeName, exchangeData] of rawData) {
      if (exchangeData.tickers.length === 0) {
        console.warn(`⚠️ No data to transform for ${exchangeName}`);
        continue;
      }

      // 배치로 심볼 해결
      const symbols = exchangeData.tickers.map(ticker => ticker.symbol);
      const symbolMappings = await this.symbolMapper.resolveMultipleSymbols(exchangeName, symbols);

      for (const ticker of exchangeData.tickers) {
        totalProcessed++;

        // 심볼 매핑 확인
        const mapping = symbolMappings[ticker.symbol];

        if (!mapping) {
          // 매핑되지 않은 심볼 로깅
          await this.logUnmappedSymbol(exchangeName, ticker.symbol);
          continue;
        }

        totalResolved++;

        // 표준화된 데이터 생성
        const standardizedTicker = {
          // 원본 데이터
          raw_symbol: ticker.symbol,
          exchange: exchangeName,
          timestamp: new Date(ticker.timestamp || exchangeData.timestamp),

          // 해결된 심볼 정보
          coin_id: mapping.coinId,
          standard_symbol: mapping.symbol,
          coin_name: mapping.name,
          coingecko_id: mapping.coinGeckoId,

          // 가격 데이터
          price: parseFloat(ticker.price),
          volume: parseFloat(ticker.volume || 0),
          high: parseFloat(ticker.high || ticker.price),
          low: parseFloat(ticker.low || ticker.price),
          open: parseFloat(ticker.open || ticker.price),
          close: parseFloat(ticker.price),

          // 추가 데이터
          bid: parseFloat(ticker.bid || 0),
          ask: parseFloat(ticker.ask || 0),
          change: parseFloat(ticker.change || 0),
          change_percent: parseFloat(ticker.changePercent || 0),
          quote_volume: parseFloat(ticker.quoteVolume || 0),

          // 메타데이터
          data_quality: this.calculateDataQuality(ticker),
          is_active: true
        };

        transformedData.push(standardizedTicker);
      }

      console.log(`🔄 ${exchangeName}: ${totalResolved}/${exchangeData.tickers.length} symbols resolved`);
    }

    console.log(`✅ Transformation completed: ${totalResolved}/${totalProcessed} records resolved`);
    return transformedData;
  }

  /**
   * 3. Load Phase: 처리된 데이터를 저장
   */
  async loadData(transformedData) {
    console.log('💾 Loading data to storage...');

    try {
      // 3-1. ClickHouse에 시계열 데이터 저장
      await this.loadToClickHouse(transformedData);

      // 3-2. Redis에 실시간 캐시 저장
      await this.loadToRedis(transformedData);

      // 3-3. PostgreSQL에 메타데이터 업데이트
      await this.updateMetadata(transformedData);

      console.log('✅ Data loaded successfully');

    } catch (error) {
      console.error('❌ Failed to load data:', error.message);
      throw error;
    }
  }

  /**
   * ClickHouse에 시계열 데이터 저장
   */
  async loadToClickHouse(data) {
    if (data.length === 0) return;

    try {
      // real_time_prices 테이블에 삽입
      const priceData = data.map(item => ({
        timestamp: item.timestamp,
        symbol: item.standard_symbol,
        exchange: item.exchange,
        price: item.price,
        volume: item.volume,
        bid_price: item.bid,
        ask_price: item.ask,
        spread: item.ask > 0 && item.bid > 0 ? ((item.ask - item.bid) / item.ask * 100) : 0
      }));

      await this.clickhouse.insert('real_time_prices', priceData);
      console.log(`📊 Inserted ${priceData.length} records to ClickHouse`);

      // 1분 OHLCV 데이터 생성 (집계)
      await this.generateOHLCVData(data);

    } catch (error) {
      console.error('ClickHouse insert error:', error.message);
      throw error;
    }
  }

  /**
   * Redis에 실시간 캐시 저장
   */
  async loadToRedis(data) {
    try {
      const pipeline = this.redis.pipeline();

      for (const item of data) {
        const cacheKey = `price:${item.standard_symbol}:${item.exchange}`;
        const cacheData = {
          price: item.price,
          volume: item.volume,
          change: item.change,
          changePercent: item.change_percent,
          timestamp: item.timestamp.getTime(),
          exchange: item.exchange
        };

        // 5초 TTL로 캐시
        pipeline.setex(cacheKey, 5, JSON.stringify(cacheData));

        // 전체 마켓 데이터도 캐시
        const marketKey = `market:${item.standard_symbol}`;
        pipeline.hset(marketKey, item.exchange, JSON.stringify(cacheData));
        pipeline.expire(marketKey, 10);
      }

      await pipeline.exec();
      console.log(`🔄 Cached ${data.length} records to Redis`);

    } catch (error) {
      console.error('Redis cache error:', error.message);
      // Redis 에러는 전체 파이프라인을 중단시키지 않음
    }
  }

  /**
   * VWAP 계산 및 저장
   */
  async calculateAndStoreVWAP(data) {
    // 코인별로 그룹화
    const coinGroups = {};

    data.forEach(item => {
      if (!coinGroups[item.standard_symbol]) {
        coinGroups[item.standard_symbol] = [];
      }
      coinGroups[item.standard_symbol].push(item);
    });

    const vwapData = [];

    for (const [symbol, items] of Object.entries(coinGroups)) {
      if (items.length === 0) continue;

      // VWAP 계산
      const vwap = this.exchangeManager.calculateVWAP(items);

      if (vwap) {
        vwapData.push({
          timestamp: new Date(),
          symbol: symbol,
          time_window: '5s',
          vwap_price: vwap.vwap,
          total_volume: vwap.totalVolume,
          total_value: vwap.totalValue,
          exchange_count: vwap.exchangeCount,
          participating_exchanges: vwap.exchanges
        });
      }
    }

    if (vwapData.length > 0) {
      await this.clickhouse.insert('vwap_data', vwapData);
      console.log(`📊 Calculated VWAP for ${vwapData.length} coins`);
    }
  }

  /**
   * 매핑되지 않은 심볼 로깅
   */
  async logUnmappedSymbol(exchange, symbol) {
    try {
      const logKey = `unmapped:${exchange}:${symbol}`;
      const count = await this.redis.incr(logKey);

      if (count === 1) {
        await this.redis.expire(logKey, 3600); // 1시간 TTL
        console.warn(`⚠️ New unmapped symbol: ${exchange}:${symbol}`);
      }

      // 많이 발생하는 경우 데이터베이스에 로그
      if (count % 100 === 0) {
        await this.db.query(
          'INSERT INTO mapping_update_logs (update_type, source, error_details, started_at, status) VALUES ($1, $2, $3, $4, $5)',
          ['manual', exchange, `Unmapped symbol: ${symbol} (count: ${count})`, new Date(), 'failed']
        );
      }

    } catch (error) {
      console.error('Failed to log unmapped symbol:', error.message);
    }
  }

  /**
   * 데이터 품질 계산
   */
  calculateDataQuality(ticker) {
    let score = 1.0;

    // 필수 필드 체크
    if (!ticker.price || ticker.price <= 0) score -= 0.5;
    if (!ticker.volume || ticker.volume < 0) score -= 0.2;
    if (!ticker.timestamp) score -= 0.1;

    // 데이터 일관성 체크
    if (ticker.high && ticker.low && ticker.high < ticker.low) score -= 0.3;
    if (ticker.bid && ticker.ask && ticker.bid > ticker.ask) score -= 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 1분 OHLCV 데이터 생성
   */
  async generateOHLCVData(data) {
    // 실시간으로는 간단한 집계만 수행
    // 실제 OHLCV는 별도 스케줄러에서 처리
    console.log('📊 OHLCV generation scheduled');
  }

  /**
   * 메타데이터 업데이트 (마지막 업데이트 시간 등)
   */
  async updateMetadata(data) {
    if (data.length === 0) return;

    try {
      const uniqueCoins = [...new Set(data.map(item => item.coin_id))];

      await this.db.query(
        'UPDATE coins SET updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)',
        [uniqueCoins]
      );

      console.log(`📝 Updated metadata for ${uniqueCoins.length} coins`);

    } catch (error) {
      console.error('Metadata update error:', error.message);
    }
  }
}

module.exports = ETLPipeline;