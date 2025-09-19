// Quick test script to verify exchange connections
const ExchangeManager = require('./src/services/ExchangeManager');

async function testExchangeConnections() {
  console.log('🧪 Testing Exchange Connections...\n');

  const manager = new ExchangeManager();

  try {
    // Test 1: Health Check
    console.log('1️⃣ Health Check:');
    const health = await manager.healthCheck();
    console.log(JSON.stringify(health, null, 2));
    console.log('');

    // Test 2: Fetch BTC ticker from all exchanges
    console.log('2️⃣ Fetching BTC price from all exchanges:');
    const btcTickers = await manager.fetchSymbolFromAllExchanges('BTCUSDT');
    btcTickers.forEach(ticker => {
      console.log(`${ticker.exchange}: $${ticker.price} (Vol: ${ticker.volume})`);
    });
    console.log('');

    // Test 3: Calculate VWAP
    console.log('3️⃣ BTC VWAP Calculation:');
    const vwap = manager.calculateVWAP(btcTickers);
    if (vwap) {
      console.log(`VWAP Price: $${vwap.vwap.toFixed(2)}`);
      console.log(`Total Volume: ${vwap.totalVolume.toFixed(2)}`);
      console.log(`Exchanges: ${vwap.exchanges.join(', ')}`);
    }
    console.log('');

    // Test 4: Fetch top 10 coins
    console.log('4️⃣ Fetching top cryptocurrencies:');
    const binance = manager.getExchange('binance');
    const topCoins = await binance.getTickers(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT']);
    topCoins.forEach(coin => {
      console.log(`${coin.symbol}: $${coin.price} (${coin.changePercent > 0 ? '+' : ''}${coin.changePercent.toFixed(2)}%)`);
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testExchangeConnections();