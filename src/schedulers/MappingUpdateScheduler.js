const cron = require('node-cron');
const SymbolMappingService = require('../services/SymbolMappingService');
const ETLPipeline = require('../services/ETLPipeline');

class MappingUpdateScheduler {
  constructor(dbConnection, clickhouseConnection, redisConnection) {
    this.db = dbConnection;
    this.clickhouse = clickhouseConnection;
    this.redis = redisConnection;

    this.symbolMapper = new SymbolMappingService(dbConnection);
    this.etlPipeline = new ETLPipeline(dbConnection, clickhouseConnection, redisConnection);

    this.isRunning = false;
  }

  /**
   * 모든 스케줄 작업 시작
   */
  start() {
    console.log('⏰ Starting mapping update scheduler...');

    // 1. 매일 오전 3시: 심볼 매핑 전체 업데이트
    cron.schedule('0 3 * * *', async () => {
      await this.runDailyMappingUpdate();
    });

    // 2. 매 10초: 실시간 ETL 파이프라인
    cron.schedule('*/10 * * * * *', async () => {
      if (!this.isRunning) {
        await this.runRealTimeETL();
      }
    });

    // 3. 매 5분: VWAP 계산
    cron.schedule('*/5 * * * *', async () => {
      await this.calculateVWAPData();
    });

    // 4. 매 6분: VWAP 기반 OHLCV 데이터 생성 (VWAP 계산 1분 후 실행)
    cron.schedule('1,7,13,19,25,31,37,43,49,55 * * * *', async () => {
      await this.generateOHLCVData();
    });

    // 5. 매 시간: 매핑 품질 체크
    cron.schedule('0 * * * *', async () => {
      await this.checkMappingQuality();
    });

    console.log('✅ All schedulers started successfully');
  }

  /**
   * 매일 심볼 매핑 업데이트
   */
  async runDailyMappingUpdate() {
    console.log('🔄 Starting daily mapping update...');

    try {
      const startTime = Date.now();

      // 로그 시작
      const logResult = await this.db.query(
        'INSERT INTO mapping_update_logs (update_type, source, started_at) VALUES ($1, $2, $3) RETURNING id',
        ['full', 'daily_scheduler', new Date()]
      );
      const logId = logResult.rows[0].id;

      // 매핑 업데이트 실행
      await this.symbolMapper.updateMappings();

      // 성공 로그 업데이트
      const duration = Date.now() - startTime;
      await this.db.query(
        'UPDATE mapping_update_logs SET status = $1, completed_at = $2 WHERE id = $3',
        ['completed', new Date(), logId]
      );

      console.log(`✅ Daily mapping update completed in ${duration}ms`);

      // Slack 알림 (선택사항)
      await this.sendNotification('📊 Daily symbol mapping update completed successfully');

    } catch (error) {
      console.error('❌ Daily mapping update failed:', error.message);
      await this.sendNotification(`❌ Daily mapping update failed: ${error.message}`);
    }
  }

  /**
   * 실시간 ETL 파이프라인
   */
  async runRealTimeETL() {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      await this.etlPipeline.runETL();
    } catch (error) {
      console.error('❌ Real-time ETL failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * VWAP 기반 OHLCV 데이터 생성 (1분 간격)
   */
  async generateOHLCVData() {
    try {
      console.log('📊 Generating VWAP-based OHLCV data...');

      // 1분, 5분, 15분, 1시간, 4시간, 1일 간격으로 OHLCV 생성
      const intervals = [
        { name: '1m', minutes: 1 },
        { name: '5m', minutes: 5 },
        { name: '15m', minutes: 15 },
        { name: '1h', minutes: 60 },
        { name: '4h', minutes: 240 },
        { name: '1d', minutes: 1440 }
      ];

      for (const interval of intervals) {
        await this.generateOHLCVForInterval(interval.name, interval.minutes);
      }

    } catch (error) {
      console.error('❌ OHLCV generation failed:', error.message);
    }
  }

  /**
   * 특정 간격으로 VWAP 기반 OHLCV 생성
   */
  async generateOHLCVForInterval(intervalName, intervalMinutes) {
    try {
      const now = new Date();
      const intervalAgo = new Date(now.getTime() - (intervalMinutes * 60000));

      console.log(`📊 Generating ${intervalName} OHLCV from VWAP data...`);

      // VWAP 데이터에서 OHLCV 계산
      const query = `
        SELECT
          symbol,
          toStartOfInterval(timestamp, toIntervalMinute(${intervalMinutes})) as candle_timestamp,
          argMin(vwap_price, timestamp) as open,
          max(vwap_price) as high,
          min(vwap_price) as low,
          argMax(vwap_price, timestamp) as close,
          sum(total_volume) as volume,
          avg(exchange_count) as avg_exchange_count,
          count(*) as vwap_points
        FROM vwap_data
        WHERE timestamp >= toDateTime('${intervalAgo.toISOString()}')
          AND timestamp < toDateTime('${now.toISOString()}')
          AND time_window IN ('5s', '1m', '5m')  -- 적절한 시간 윈도우만 사용
        GROUP BY symbol, candle_timestamp
        HAVING count(*) > 0
        ORDER BY symbol, candle_timestamp
      `;

      const ohlcvData = await this.clickhouse.query(query);

      if (ohlcvData.length > 0) {
        const insertData = ohlcvData.map(row => ({
          timestamp: row.candle_timestamp,
          symbol: row.symbol,
          exchange: 'vwap_aggregated',  // VWAP 기반임을 표시
          interval: intervalName,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
          quote_volume: row.volume * row.close,  // 볼륨 * 종가로 Quote Volume 계산
          trade_count: row.vwap_points,
          source: 'vwap'
        }));

        await this.clickhouse.insert('ohlcv', insertData);
        console.log(`📊 Generated ${insertData.length} ${intervalName} VWAP-based OHLCV records`);

        // 상세 통계 로깅
        const symbols = [...new Set(insertData.map(item => item.symbol))];
        console.log(`   📈 Symbols processed: ${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? '...' : ''} (${symbols.length} total)`);
      } else {
        console.log(`⚠️ No VWAP data available for ${intervalName} interval`);
      }

    } catch (error) {
      console.error(`❌ Failed to generate ${intervalName} OHLCV:`, error.message);
    }
  }

  /**
   * VWAP 계산 (5분 간격)
   */
  async calculateVWAPData() {
    try {
      console.log('🧮 Calculating VWAP data...');

      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 300000);

      // 지난 5분간 데이터로 VWAP 계산
      const query = `
        SELECT
          symbol,
          toStartOfInterval(timestamp, toIntervalMinute(5)) as interval_timestamp,
          sum(price * volume) / sum(volume) as vwap_price,
          sum(volume) as total_volume,
          sum(price * volume) as total_value,
          uniq(exchange) as exchange_count,
          groupArray(exchange) as participating_exchanges
        FROM real_time_prices
        WHERE timestamp >= toDateTime('${fiveMinutesAgo.toISOString()}')
          AND timestamp < toDateTime('${now.toISOString()}')
          AND volume > 0
        GROUP BY symbol, interval_timestamp
        HAVING total_volume > 0
      `;

      const vwapData = await this.clickhouse.query(query);

      if (vwapData.length > 0) {
        const insertData = vwapData.map(row => ({
          timestamp: row.interval_timestamp,
          symbol: row.symbol,
          time_window: '5m',
          vwap_price: row.vwap_price,
          total_volume: row.total_volume,
          total_value: row.total_value,
          exchange_count: row.exchange_count,
          participating_exchanges: row.participating_exchanges
        }));

        await this.clickhouse.insert('vwap_data', insertData);
        console.log(`🧮 Calculated VWAP for ${insertData.length} symbols`);
      }

    } catch (error) {
      console.error('❌ VWAP calculation failed:', error.message);
    }
  }

  /**
   * 매핑 품질 체크
   */
  async checkMappingQuality() {
    try {
      console.log('🔍 Checking mapping quality...');

      // 1. 매핑되지 않은 심볼 통계
      const unmappedCount = await this.redis.keys('unmapped:*');

      // 2. 낮은 신뢰도 매핑 확인
      const lowConfidenceQuery = `
        SELECT exchange_id, exchange_symbol, confidence_score
        FROM symbol_mappings
        WHERE confidence_score < 0.8
          AND is_active = true
        ORDER BY confidence_score ASC
        LIMIT 20
      `;

      const lowConfidenceMappings = await this.db.query(lowConfidenceQuery);

      // 3. 최근 업데이트되지 않은 매핑
      const staleQuery = `
        SELECT exchange_id, count(*) as stale_count
        FROM symbol_mappings
        WHERE last_verified < NOW() - INTERVAL '7 days'
          AND is_active = true
        GROUP BY exchange_id
      `;

      const staleMappings = await this.db.query(staleQuery);

      // 품질 리포트 생성
      const qualityReport = {
        unmapped_symbols: unmappedCount.length,
        low_confidence_mappings: lowConfidenceMappings.rows.length,
        stale_mappings: staleMappings.rows,
        timestamp: new Date()
      };

      console.log('📊 Mapping Quality Report:', qualityReport);

      // 심각한 품질 문제가 있으면 알림
      if (unmappedCount.length > 50 || lowConfidenceMappings.rows.length > 10) {
        await this.sendNotification(`⚠️ Mapping quality issue detected: ${unmappedCount.length} unmapped symbols, ${lowConfidenceMappings.rows.length} low confidence mappings`);
      }

    } catch (error) {
      console.error('❌ Mapping quality check failed:', error.message);
    }
  }

  /**
   * 알림 전송 (Slack, 이메일 등)
   */
  async sendNotification(message) {
    try {
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) return;

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[Crypto Tracker] ${message}`,
          timestamp: new Date().toISOString()
        })
      });

    } catch (error) {
      console.error('Notification send failed:', error.message);
    }
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    console.log('⏹️ Stopping mapping update scheduler...');
    cron.destroy();
  }
}

module.exports = MappingUpdateScheduler;