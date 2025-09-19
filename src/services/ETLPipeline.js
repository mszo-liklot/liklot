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
   * 1. Extract Phase: 거래소에서 원시 데이터 수집 (병렬 처리)
   */
  async extractData() {
    console.log('📥 Extracting data from exchanges in parallel...');

    const activeExchanges = this.exchangeManager.getActiveExchanges();
    const extractionStartTime = Date.now();

    // 모든 거래소에서 병렬로 데이터 수집
    const promises = activeExchanges.map(exchangeName =>
      this.extractFromSingleExchange(exchangeName)
    );

    console.log(`🚀 Starting parallel extraction from ${activeExchanges.length} exchanges...`);
    const results = await Promise.allSettled(promises);

    // 결과 처리 및 분석
    const exchangeData = this.processExtractionResults(results, activeExchanges);

    const totalDuration = Date.now() - extractionStartTime;
    console.log(`✅ Parallel extraction completed in ${totalDuration}ms`);

    return exchangeData;
  }

  /**
   * 단일 거래소에서 데이터 추출 (타임아웃 및 에러 처리 포함)
   */
  async extractFromSingleExchange(exchangeName) {
    const startTime = Date.now();
    const timeout = 15000; // 15초 타임아웃

    try {
      const exchange = this.exchangeManager.getExchange(exchangeName);

      if (!exchange) {
        throw new Error(`Exchange '${exchangeName}' not found`);
      }

      // 타임아웃 Promise 생성
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
      });

      // 데이터 수집 Promise
      const dataPromise = exchange.getTickers();

      // Race condition: 데이터 수집 vs 타임아웃
      const tickers = await Promise.race([dataPromise, timeoutPromise]);

      const duration = Date.now() - startTime;

      return {
        exchangeName,
        success: true,
        data: {
          exchange: exchangeName,
          timestamp: Date.now(),
          tickers: tickers || [],
          count: tickers ? tickers.length : 0
        },
        duration,
        error: null
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${exchangeName} extraction failed after ${duration}ms:`, error.message);

      return {
        exchangeName,
        success: false,
        data: {
          exchange: exchangeName,
          timestamp: Date.now(),
          tickers: [],
          count: 0,
          error: error.message
        },
        duration,
        error: error.message
      };
    }
  }

  /**
   * 추출 결과 처리 및 통계 생성
   */
  processExtractionResults(results, exchangeNames) {
    const exchangeData = new Map();
    const stats = {
      total: results.length,
      successful: 0,
      failed: 0,
      totalTickers: 0,
      totalDuration: 0,
      failures: []
    };

    results.forEach((result, index) => {
      const exchangeName = exchangeNames[index];

      if (result.status === 'fulfilled') {
        const extractionResult = result.value;

        exchangeData.set(exchangeName, extractionResult.data);

        if (extractionResult.success) {
          stats.successful++;
          stats.totalTickers += extractionResult.data.count;
          console.log(`✅ ${exchangeName}: ${extractionResult.data.count} tickers in ${extractionResult.duration}ms`);
        } else {
          stats.failed++;
          stats.failures.push({
            exchange: exchangeName,
            error: extractionResult.error,
            duration: extractionResult.duration
          });
          console.log(`❌ ${exchangeName}: Failed in ${extractionResult.duration}ms`);
        }

        stats.totalDuration = Math.max(stats.totalDuration, extractionResult.duration);
      } else {
        stats.failed++;
        stats.failures.push({
          exchange: exchangeName,
          error: result.reason?.message || 'Unknown error',
          duration: 0
        });

        // 실패한 거래소도 빈 데이터로 추가
        exchangeData.set(exchangeName, {
          exchange: exchangeName,
          timestamp: Date.now(),
          tickers: [],
          count: 0,
          error: result.reason?.message || 'Unknown error'
        });

        console.log(`❌ ${exchangeName}: Promise rejected -`, result.reason?.message);
      }
    });

    // 통계 출력
    console.log(`📊 Extraction Summary:`);
    console.log(`   ✅ Successful: ${stats.successful}/${stats.total} exchanges`);
    console.log(`   ❌ Failed: ${stats.failed}/${stats.total} exchanges`);
    console.log(`   📈 Total tickers: ${stats.totalTickers}`);
    console.log(`   ⏱️ Max duration: ${stats.totalDuration}ms`);

    if (stats.failures.length > 0) {
      console.log(`   🔧 Failed exchanges:`, stats.failures.map(f => f.exchange).join(', '));
    }

    // 실패율이 높으면 경고
    if (stats.failed / stats.total > 0.5) {
      console.warn(`⚠️ High failure rate: ${stats.failed}/${stats.total} exchanges failed`);
    }

    return exchangeData;
  }

  /**
   * 2. Transform Phase: 심볼 해결 및 데이터 정규화 (병렬 처리)
   */
  async transformData(rawData) {
    console.log('🔄 Transforming data with parallel symbol resolution...');

    const transformationStartTime = Date.now();

    // 거래소별 병렬 변환 처리
    const transformationPromises = Array.from(rawData.entries()).map(([exchangeName, exchangeData]) =>
      this.transformExchangeData(exchangeName, exchangeData)
    );

    console.log(`🚀 Starting parallel transformation for ${transformationPromises.length} exchanges...`);
    const results = await Promise.allSettled(transformationPromises);

    // 결과 통합 및 통계 생성
    const transformationResult = this.consolidateTransformationResults(results);

    const totalDuration = Date.now() - transformationStartTime;
    console.log(`✅ Parallel transformation completed in ${totalDuration}ms`);

    return transformationResult.transformedData;
  }

  /**
   * 단일 거래소 데이터 변환 처리
   */
  async transformExchangeData(exchangeName, exchangeData) {
    const startTime = Date.now();

    try {
      if (exchangeData.tickers.length === 0) {
        console.warn(`⚠️ No data to transform for ${exchangeName}`);
        return {
          exchangeName,
          success: true,
          transformedData: [],
          stats: { processed: 0, resolved: 0, failed: 0 },
          duration: Date.now() - startTime
        };
      }

      // 배치로 심볼 해결 (기존 방식 유지 - 이미 최적화됨)
      const symbols = exchangeData.tickers.map(ticker => ticker.symbol);
      const symbolMappings = await this.symbolMapper.resolveMultipleSymbols(exchangeName, symbols);

      // 티커 데이터 병렬 변환
      const transformedTickers = await this.processTickersInParallel(
        exchangeName,
        exchangeData,
        symbolMappings
      );

      const duration = Date.now() - startTime;
      const stats = {
        processed: exchangeData.tickers.length,
        resolved: transformedTickers.length,
        failed: exchangeData.tickers.length - transformedTickers.length
      };

      console.log(`✅ ${exchangeName}: ${stats.resolved}/${stats.processed} symbols resolved in ${duration}ms`);

      return {
        exchangeName,
        success: true,
        transformedData: transformedTickers,
        stats,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ ${exchangeName} transformation failed after ${duration}ms:`, error.message);

      return {
        exchangeName,
        success: false,
        transformedData: [],
        stats: { processed: exchangeData.tickers?.length || 0, resolved: 0, failed: exchangeData.tickers?.length || 0 },
        duration,
        error: error.message
      };
    }
  }

  /**
   * 티커 데이터 병렬 처리 (배치 단위)
   */
  async processTickersInParallel(exchangeName, exchangeData, symbolMappings) {
    const batchSize = 100; // 100개씩 배치 처리
    const tickers = exchangeData.tickers;
    const transformedData = [];

    // 배치 생성
    const batches = [];
    for (let i = 0; i < tickers.length; i += batchSize) {
      batches.push(tickers.slice(i, i + batchSize));
    }

    // 배치별 병렬 처리
    const batchPromises = batches.map((batch, batchIndex) =>
      this.processBatch(exchangeName, exchangeData, batch, symbolMappings, batchIndex)
    );

    const batchResults = await Promise.all(batchPromises);

    // 결과 통합
    batchResults.forEach(batchResult => {
      transformedData.push(...batchResult);
    });

    return transformedData;
  }

  /**
   * 배치 단위 티커 처리
   */
  async processBatch(exchangeName, exchangeData, tickerBatch, symbolMappings, batchIndex) {
    const transformedBatch = [];

    for (const ticker of tickerBatch) {
      // 심볼 매핑 확인
      const mapping = symbolMappings[ticker.symbol];

      if (!mapping) {
        // 매핑되지 않은 심볼 로깅 (비동기로 처리하여 성능 향상)
        this.logUnmappedSymbol(exchangeName, ticker.symbol).catch(err => {
          console.warn(`Failed to log unmapped symbol ${ticker.symbol}:`, err.message);
        });
        continue;
      }

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

      transformedBatch.push(standardizedTicker);
    }

    return transformedBatch;
  }

  /**
   * 변환 결과 통합 및 통계 생성
   */
  consolidateTransformationResults(results) {
    const transformedData = [];
    const consolidatedStats = {
      totalExchanges: results.length,
      successfulExchanges: 0,
      failedExchanges: 0,
      totalProcessed: 0,
      totalResolved: 0,
      totalFailed: 0,
      exchangeStats: {},
      failures: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const exchangeResult = result.value;

        if (exchangeResult.success) {
          consolidatedStats.successfulExchanges++;
          transformedData.push(...exchangeResult.transformedData);

          consolidatedStats.totalProcessed += exchangeResult.stats.processed;
          consolidatedStats.totalResolved += exchangeResult.stats.resolved;
          consolidatedStats.totalFailed += exchangeResult.stats.failed;

          consolidatedStats.exchangeStats[exchangeResult.exchangeName] = {
            ...exchangeResult.stats,
            duration: exchangeResult.duration
          };
        } else {
          consolidatedStats.failedExchanges++;
          consolidatedStats.failures.push({
            exchange: exchangeResult.exchangeName,
            error: exchangeResult.error,
            duration: exchangeResult.duration
          });
        }
      } else {
        consolidatedStats.failedExchanges++;
        consolidatedStats.failures.push({
          exchange: `unknown_${index}`,
          error: result.reason?.message || 'Unknown error',
          duration: 0
        });
      }
    });

    // 통계 출력
    console.log(`📊 Transformation Summary:`);
    console.log(`   ✅ Successful exchanges: ${consolidatedStats.successfulExchanges}/${consolidatedStats.totalExchanges}`);
    console.log(`   ❌ Failed exchanges: ${consolidatedStats.failedExchanges}/${consolidatedStats.totalExchanges}`);
    console.log(`   📈 Total records: ${consolidatedStats.totalResolved}/${consolidatedStats.totalProcessed} resolved`);

    if (consolidatedStats.failures.length > 0) {
      console.log(`   🔧 Failed exchanges:`, consolidatedStats.failures.map(f => f.exchange).join(', '));
    }

    // 변환 성공률 체크
    const resolutionRate = consolidatedStats.totalProcessed > 0 ?
      (consolidatedStats.totalResolved / consolidatedStats.totalProcessed) : 0;

    if (resolutionRate < 0.5) {
      console.warn(`⚠️ Low symbol resolution rate: ${Math.round(resolutionRate * 100)}%`);
    }

    return {
      transformedData,
      stats: consolidatedStats
    };
  }

  /**
   * 3. Load Phase: 처리된 데이터를 저장 (병렬 처리)
   */
  async loadData(transformedData) {
    console.log('💾 Loading data to storage in parallel...');

    const loadStartTime = Date.now();

    try {
      // 데이터베이스 작업을 병렬로 실행
      const loadingOperations = [
        {
          name: 'ClickHouse',
          operation: () => this.loadToClickHouse(transformedData),
          critical: true // 중요한 작업 (실패 시 전체 실패)
        },
        {
          name: 'Redis Cache',
          operation: () => this.loadToRedis(transformedData),
          critical: false // 캐시는 실패해도 전체 프로세스 중단하지 않음
        },
        {
          name: 'PostgreSQL Metadata',
          operation: () => this.updateMetadata(transformedData),
          critical: false // 메타데이터 업데이트 실패해도 계속 진행
        }
      ];

      console.log(`🚀 Starting parallel loading to ${loadingOperations.length} storage systems...`);

      // 병렬 실행
      const results = await Promise.allSettled(
        loadingOperations.map(op =>
          this.executeLoadOperation(op.name, op.operation, op.critical)
        )
      );

      // 결과 분석 및 처리
      const loadResult = this.analyzeLoadResults(results, loadingOperations);

      // VWAP 계산은 ClickHouse 저장 완료 후 실행
      if (loadResult.clickHouseSuccess) {
        console.log('🧮 Calculating VWAP after ClickHouse storage...');
        try {
          await this.calculateAndStoreVWAP(transformedData);
          console.log('✅ VWAP calculation completed');
        } catch (error) {
          console.warn('⚠️ VWAP calculation failed:', error.message);
          // VWAP 실패는 전체 프로세스를 중단시키지 않음
        }
      }

      const totalDuration = Date.now() - loadStartTime;
      console.log(`✅ Parallel loading completed in ${totalDuration}ms`);

      // 중요한 작업이 실패했으면 에러 발생
      if (!loadResult.allCriticalSuccess) {
        throw new Error('Critical storage operations failed');
      }

    } catch (error) {
      console.error('❌ Failed to load data:', error.message);
      throw error;
    }
  }

  /**
   * 개별 로딩 작업 실행 및 타임아웃 처리
   */
  async executeLoadOperation(operationName, operation, isCritical) {
    const startTime = Date.now();
    const timeout = 30000; // 30초 타임아웃

    try {
      // 타임아웃 Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${operationName} timeout after ${timeout}ms`)), timeout);
      });

      // 실제 작업 실행
      await Promise.race([operation(), timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(`✅ ${operationName}: Completed in ${duration}ms`);

      return {
        name: operationName,
        success: true,
        duration,
        critical: isCritical
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const logLevel = isCritical ? 'error' : 'warn';
      console[logLevel](`${isCritical ? '❌' : '⚠️'} ${operationName}: Failed in ${duration}ms -`, error.message);

      return {
        name: operationName,
        success: false,
        duration,
        critical: isCritical,
        error: error.message
      };
    }
  }

  /**
   * 로딩 결과 분석
   */
  analyzeLoadResults(results, operations) {
    const analysis = {
      total: results.length,
      successful: 0,
      failed: 0,
      criticalOperations: 0,
      criticalSuccessful: 0,
      allCriticalSuccess: true,
      clickHouseSuccess: false,
      failures: []
    };

    results.forEach((result, index) => {
      const operation = operations[index];

      if (result.status === 'fulfilled') {
        const opResult = result.value;

        if (opResult.success) {
          analysis.successful++;
          if (opResult.critical) {
            analysis.criticalSuccessful++;
          }
          if (opResult.name === 'ClickHouse') {
            analysis.clickHouseSuccess = true;
          }
        } else {
          analysis.failed++;
          if (opResult.critical) {
            analysis.allCriticalSuccess = false;
          }
          analysis.failures.push(opResult);
        }

        if (opResult.critical) {
          analysis.criticalOperations++;
        }
      } else {
        analysis.failed++;
        if (operation.critical) {
          analysis.allCriticalSuccess = false;
          analysis.criticalOperations++;
        }
        analysis.failures.push({
          name: operation.name,
          error: result.reason?.message || 'Unknown error',
          critical: operation.critical
        });
      }
    });

    // 통계 출력
    console.log(`📊 Loading Summary:`);
    console.log(`   ✅ Successful: ${analysis.successful}/${analysis.total} operations`);
    console.log(`   ❌ Failed: ${analysis.failed}/${analysis.total} operations`);
    console.log(`   🔴 Critical success: ${analysis.criticalSuccessful}/${analysis.criticalOperations}`);

    if (analysis.failures.length > 0) {
      console.log(`   🔧 Failed operations:`, analysis.failures.map(f => `${f.name}${f.critical ? ' (critical)' : ''}`).join(', '));
    }

    return analysis;
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