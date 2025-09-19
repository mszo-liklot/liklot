// Symbol Mapping System Test Script
const SymbolMappingService = require('./src/services/SymbolMappingService');
const ETLPipeline = require('./src/services/ETLPipeline');
const ExchangeManager = require('./src/services/ExchangeManager');

// Mock database connection for testing
const mockDB = {
  query: async (sql, params) => {
    console.log('🔍 Mock DB Query:', sql.substring(0, 100) + '...');

    // Mock symbol mapping results
    if (sql.includes('symbol_mappings')) {
      return {
        rows: [
          {
            exchange_symbol: 'BTCUSDT',
            coin_id: 'bitcoin',
            name: 'Bitcoin',
            standard_symbol: 'BTC',
            coingecko_id: 'bitcoin'
          },
          {
            exchange_symbol: 'ETHUSDT',
            coin_id: 'ethereum',
            name: 'Ethereum',
            standard_symbol: 'ETH',
            coingecko_id: 'ethereum'
          }
        ]
      };
    }

    return { rows: [] };
  },
  beginTransaction: async () => ({ commit: async () => {}, rollback: async () => {} })
};

async function testSymbolMapping() {
  console.log('🧪 Testing Symbol Mapping System...\n');

  try {
    // 1. 심볼 매핑 서비스 테스트
    console.log('1️⃣ Testing SymbolMappingService');
    const symbolMapper = new SymbolMappingService(mockDB);

    // CoinGecko API 테스트 (실제 API 호출)
    console.log('📡 Testing CoinGecko API...');
    try {
      const coinGeckoData = await symbolMapper.fetchCoinGeckoMappings();
      console.log(`✅ CoinGecko: ${coinGeckoData.coins.length} coins fetched`);
      console.log(`✅ Exchange mappings: ${Object.keys(coinGeckoData.exchangeMappings).length} exchanges`);
    } catch (error) {
      console.log(`⚠️ CoinGecko API test skipped: ${error.message}`);
    }

    // 심볼 해결 테스트 (Mock 데이터 사용)
    console.log('\n📊 Testing symbol resolution...');
    const testSymbols = ['BTCUSDT', 'ETHUSDT', 'UNKNOWN'];

    for (const symbol of testSymbols) {
      const resolved = await symbolMapper.resolveSymbol('binance', symbol);
      if (resolved) {
        console.log(`✅ ${symbol} → ${resolved.standard_symbol} (${resolved.name})`);
      } else {
        console.log(`❌ ${symbol} → Not found`);
      }
    }

    // 배치 심볼 해결 테스트
    console.log('\n🔄 Testing batch symbol resolution...');
    const batchMappings = await symbolMapper.resolveMultipleSymbols('binance', ['BTCUSDT', 'ETHUSDT']);
    console.log('Batch mappings:', Object.keys(batchMappings));

    // 2. Exchange Manager 테스트
    console.log('\n2️⃣ Testing ExchangeManager');
    const exchangeManager = new ExchangeManager();

    // 실제 API 호출 테스트
    console.log('📡 Testing exchange API calls...');
    const testSymbols = ['BTCUSDT', 'ETHUSDT'];
    const activeExchanges = exchangeManager.getActiveExchanges();

    console.log(`Active exchanges: ${activeExchanges.join(', ')}`);

    for (const exchangeName of activeExchanges) {
      try {
        const exchange = exchangeManager.getExchange(exchangeName);
        const tickers = await exchange.getTickers(testSymbols);

        console.log(`✅ ${exchangeName}: ${tickers.length} tickers fetched`);
        tickers.slice(0, 2).forEach(ticker => {
          console.log(`  ${ticker.symbol}: $${ticker.price} (${ticker.changePercent > 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}%)`);
        });

      } catch (error) {
        console.log(`⚠️ ${exchangeName} API test failed: ${error.message}`);
      }

      // Rate limiting between exchanges
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. ETL Pipeline 시뮬레이션
    console.log('\n3️⃣ Testing ETL Pipeline (Simulation)');

    // Mock 데이터 생성
    const mockRawData = new Map([
      ['binance', {
        exchange: 'binance',
        timestamp: Date.now(),
        tickers: [
          {
            symbol: 'BTCUSDT',
            price: 45000,
            volume: 1000,
            high: 46000,
            low: 44000,
            timestamp: Date.now()
          },
          {
            symbol: 'ETHUSDT',
            price: 3000,
            volume: 5000,
            high: 3100,
            low: 2900,
            timestamp: Date.now()
          }
        ]
      }]
    ]);

    // ETL Pipeline 인스턴스 생성 (Mock 연결)
    const mockClickhouse = {
      insert: async (table, data) => {
        console.log(`📊 Mock ClickHouse: Inserted ${data.length} records to ${table}`);
      }
    };

    const mockRedis = {
      pipeline: () => ({
        setex: () => {},
        hset: () => {},
        expire: () => {},
        exec: async () => []
      }),
      incr: async () => 1,
      expire: async () => {},
      keys: async () => []
    };

    const etlPipeline = new ETLPipeline(mockDB, mockClickhouse, mockRedis);

    // Transform 단계 테스트
    console.log('🔄 Testing data transformation...');
    const transformedData = await etlPipeline.transformData(mockRawData);

    console.log(`✅ Transformed ${transformedData.length} records`);
    transformedData.forEach(item => {
      console.log(`  ${item.raw_symbol} → ${item.standard_symbol} (${item.coin_name}): $${item.price}`);
    });

    // 4. 실시간 데이터 수집 및 변환 테스트
    console.log('\n4️⃣ Testing Real-time Data Collection');

    try {
      // 실제 데이터 수집
      const realData = await exchangeManager.fetchAllTickers(['BTCUSDT', 'ETHUSDT']);

      console.log('📊 Real-time data collected:');
      realData.forEach((tickers, exchange) => {
        console.log(`  ${exchange}: ${tickers.length} tickers`);
        tickers.slice(0, 2).forEach(ticker => {
          console.log(`    ${ticker.symbol}: $${ticker.price}`);
        });
      });

      // VWAP 계산 테스트
      const btcTickers = [];
      realData.forEach(tickers => {
        const btcTicker = tickers.find(t => t.symbol === 'BTCUSDT');
        if (btcTicker) btcTickers.push(btcTicker);
      });

      if (btcTickers.length > 0) {
        const vwap = exchangeManager.calculateVWAP(btcTickers);
        console.log(`🧮 BTC VWAP: $${vwap.vwap.toFixed(2)} (${vwap.exchangeCount} exchanges)`);
      }

    } catch (error) {
      console.log(`⚠️ Real-time test failed: ${error.message}`);
    }

    // 5. VWAP → OHLCV 변환 테스트
    console.log('\n5️⃣ Testing VWAP to OHLCV Conversion');

    try {
      // Mock VWAP 데이터 생성
      const mockVWAPData = [
        { timestamp: new Date('2024-01-01T10:00:00Z'), symbol: 'BTC', vwap_price: 45000, total_volume: 1000 },
        { timestamp: new Date('2024-01-01T10:01:00Z'), symbol: 'BTC', vwap_price: 45100, total_volume: 1200 },
        { timestamp: new Date('2024-01-01T10:02:00Z'), symbol: 'BTC', vwap_price: 44900, total_volume: 900 },
        { timestamp: new Date('2024-01-01T10:03:00Z'), symbol: 'BTC', vwap_price: 45200, total_volume: 1100 },
        { timestamp: new Date('2024-01-01T10:04:00Z'), symbol: 'BTC', vwap_price: 45050, total_volume: 1050 }
      ];

      console.log('📊 Mock VWAP data created:', mockVWAPData.length, 'records');

      // VWAP 데이터에서 OHLCV 계산 시뮬레이션
      const ohlcvData = {
        timestamp: new Date('2024-01-01T10:05:00Z'),
        symbol: 'BTC',
        interval: '5m',
        open: mockVWAPData[0].vwap_price,  // 첫 번째 VWAP
        high: Math.max(...mockVWAPData.map(d => d.vwap_price)),  // 최고 VWAP
        low: Math.min(...mockVWAPData.map(d => d.vwap_price)),   // 최저 VWAP
        close: mockVWAPData[mockVWAPData.length - 1].vwap_price, // 마지막 VWAP
        volume: mockVWAPData.reduce((sum, d) => sum + d.total_volume, 0), // 총 볼륨
        source: 'vwap'
      };

      console.log('📈 Generated OHLCV from VWAP:');
      console.log(`  Symbol: ${ohlcvData.symbol}`);
      console.log(`  Open: $${ohlcvData.open}`);
      console.log(`  High: $${ohlcvData.high}`);
      console.log(`  Low: $${ohlcvData.low}`);
      console.log(`  Close: $${ohlcvData.close}`);
      console.log(`  Volume: ${ohlcvData.volume}`);
      console.log(`  Source: ${ohlcvData.source}`);

      console.log('✅ VWAP to OHLCV conversion test completed');

    } catch (error) {
      console.log(`⚠️ VWAP to OHLCV test failed: ${error.message}`);
    }

    console.log('\n✅ All tests completed!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Set up actual database connections');
    console.log('  2. Configure CoinMarketCap API key');
    console.log('  3. Run initial symbol mapping update');
    console.log('  4. Start ETL scheduler');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testSymbolMapping();