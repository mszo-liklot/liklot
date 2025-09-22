const BinanceExchange = require('./exchanges/BinanceExchange');
const UpbitExchange = require('./exchanges/UpbitExchange');
const CoinbaseExchange = require('./exchanges/CoinbaseExchange');
const BithumbExchange = require('./exchanges/BithumbExchange');
const KuCoinExchange = require('./exchanges/KuCoinExchange');
const OKXExchange = require('./exchanges/OKXExchange');
const BybitExchange = require('./exchanges/BybitExchange');
const GateExchange = require('./exchanges/GateExchange');
const HuobiExchange = require('./exchanges/HuobiExchange');
const KrakenExchange = require('./exchanges/KrakenExchange');
const MEXCExchange = require('./exchanges/MEXCExchange');
const BitfinexExchange = require('./exchanges/BitfinexExchange');
const BitstampExchange = require('./exchanges/BitstampExchange');
const GeminiExchange = require('./exchanges/GeminiExchange');
const CryptoComExchange = require('./exchanges/CryptoComExchange');
const HTXExchange = require('./exchanges/HTXExchange');
const CoinoneExchange = require('./exchanges/CoinoneExchange');
const KorbitExchange = require('./exchanges/KorbitExchange');
const BitpandaExchange = require('./exchanges/BitpandaExchange');
const LunoExchange = require('./exchanges/LunoExchange');
const WhiteBitExchange = require('./exchanges/WhiteBitExchange');
const PoloniexExchange = require('./exchanges/PoloniexExchange');
const PhemexExchange = require('./exchanges/PhemexExchange');
const BitgetExchange = require('./exchanges/BitgetExchange');
const BingXExchange = require('./exchanges/BingXExchange');
const DigiFinexExchange = require('./exchanges/DigiFinexExchange');
const BitMartExchange = require('./exchanges/BitMartExchange');
const AscendEXExchange = require('./exchanges/AscendEXExchange');
const ProBitExchange = require('./exchanges/ProBitExchange');
const CoinWExchange = require('./exchanges/CoinWExchange');
const BittrexExchange = require('./exchanges/BittrexExchange');
const WazirXExchange = require('./exchanges/WazirXExchange');
const CoinDCXExchange = require('./exchanges/CoinDCXExchange');
const IndodaxExchange = require('./exchanges/IndodaxExchange');
const TokenizeExchange = require('./exchanges/TokenizeExchange');
const BitsoExchange = require('./exchanges/BitsoExchange');
const NovaDAXExchange = require('./exchanges/NovaDAXExchange');
const BTCTurkExchange = require('./exchanges/BTCTurkExchange');
const BitVavoExchange = require('./exchanges/BitVavoExchange');
const XT_Exchange = require('./exchanges/XT_Exchange');
const LBankExchange = require('./exchanges/LBankExchange');
const BigONEExchange = require('./exchanges/BigONEExchange');

class ExchangeManager {
  constructor() {
    this.exchanges = new Map();
    this.initialize();
  }

  initialize() {
    // Initialize exchanges (총 42개 거래소)

    // Tier 1: 글로벌 메이저 거래소 (Top 10)
    this.exchanges.set('binance', new BinanceExchange());       // #1 세계 최대
    this.exchanges.set('coinbase', new CoinbaseExchange());     // #2 미국 최대
    this.exchanges.set('kucoin', new KuCoinExchange());         // #3 알트코인 강세
    this.exchanges.set('okx', new OKXExchange());               // #4 파생상품
    this.exchanges.set('bybit', new BybitExchange());           // #5 파생상품
    this.exchanges.set('gate', new GateExchange());             // #6 다양성
    this.exchanges.set('huobi', new HuobiExchange());           // #7 아시아
    this.exchanges.set('kraken', new KrakenExchange());         // #8 보안
    this.exchanges.set('mexc', new MEXCExchange());             // #9 신규상장
    this.exchanges.set('bitget', new BitgetExchange());         // #10 신흥강자

    // Tier 2: 지역별 주요 거래소 (Regional Leaders)
    this.exchanges.set('upbit', new UpbitExchange());           // 🇰🇷 한국 #1
    this.exchanges.set('bithumb', new BithumbExchange());       // 🇰🇷 한국 #2
    this.exchanges.set('coinone', new CoinoneExchange());       // 🇰🇷 한국 #3
    this.exchanges.set('korbit', new KorbitExchange());         // 🇰🇷 한국 #4
    this.exchanges.set('wazirx', new WazirXExchange());         // 🇮🇳 인도 #1
    this.exchanges.set('coindcx', new CoinDCXExchange());       // 🇮🇳 인도 #2
    this.exchanges.set('indodax', new IndodaxExchange());       // 🇮🇩 인도네시아 #1
    this.exchanges.set('tokenize', new TokenizeExchange());     // 🇲🇾 말레이시아 #1
    this.exchanges.set('bitso', new BitsoExchange());           // 🇲🇽 멕시코 #1
    this.exchanges.set('novadax', new NovaDAXExchange());       // 🇧🇷 브라질 #1
    this.exchanges.set('btcturk', new BTCTurkExchange());       // 🇹🇷 터키 #1
    this.exchanges.set('bitpanda', new BitpandaExchange());     // 🇦🇹 오스트리아 #1
    this.exchanges.set('bitvavo', new BitVavoExchange());       // 🇳🇱 네덜란드 #1
    this.exchanges.set('luno', new LunoExchange());             // 🌍 아프리카 #1
    this.exchanges.set('gemini', new GeminiExchange());         // 🇺🇸 미국 규제준수

    // Tier 3: 글로벌 확장 거래소 (Global Expansion)
    this.exchanges.set('bitfinex', new BitfinexExchange());     // 전문거래
    this.exchanges.set('bitstamp', new BitstampExchange());     // 유럽 전통
    this.exchanges.set('crypto_com', new CryptoComExchange());  // 마케팅 강화
    this.exchanges.set('htx', new HTXExchange());               // Huobi 리브랜딩
    this.exchanges.set('whitebit', new WhiteBitExchange());     // 동유럽
    this.exchanges.set('poloniex', new PoloniexExchange());     // 미국 전통
    this.exchanges.set('phemex', new PhemexExchange());         // 싱가포르

    // Tier 4: 신흥 및 특화 거래소 (Emerging & Specialized)
    this.exchanges.set('bingx', new BingXExchange());           // 소셜 트레이딩
    this.exchanges.set('digifinex', new DigiFinexExchange());   // 아시아 신흥
    this.exchanges.set('bitmart', new BitMartExchange());       // 다국가 지원
    this.exchanges.set('ascendex', new AscendEXExchange());     // DeFi 특화
    this.exchanges.set('probit', new ProBitExchange());         // 한국 기반
    this.exchanges.set('coinw', new CoinWExchange());           // 아시아 확장
    this.exchanges.set('bittrex', new BittrexExchange());       // 미국 전통
    this.exchanges.set('xt', new XT_Exchange());                // 중국 기반
    this.exchanges.set('lbank', new LBankExchange());           // 글로벌 확장
    this.exchanges.set('bigone', new BigONEExchange());         // DeFi & 혁신

    console.log(`🚀 Initialized ${this.exchanges.size} exchanges`);
    console.log(`   🌏 Asia Pacific: ${this.getRegionalCount('asia')} exchanges`);
    console.log(`   🌍 Europe & Africa: ${this.getRegionalCount('europe')} exchanges`);
    console.log(`   🌎 Americas: ${this.getRegionalCount('americas')} exchanges`);
    console.log(`   🌐 Total global coverage: ${this.exchanges.size} exchanges across 6 continents`);
    console.log(`   💰 Supported currencies: USD, EUR, KRW, INR, IDR, MYR, MXN, BRL, TRY, ZAR, JPY, GBP+`);
  }

  getRegionalCount(region) {
    const asiaExchanges = ['upbit', 'bithumb', 'coinone', 'korbit', 'wazirx', 'coindcx', 'indodax', 'tokenize', 'huobi', 'okx', 'bybit', 'gate', 'mexc', 'bitget', 'bingx', 'digifinex', 'coinw', 'xt', 'lbank', 'bigone', 'phemex', 'crypto_com', 'htx'];
    const europeExchanges = ['bitpanda', 'bitvavo', 'luno', 'bitfinex', 'bitstamp', 'whitebit', 'kraken', 'btcturk'];
    const americasExchanges = ['coinbase', 'gemini', 'bittrex', 'poloniex', 'bitso', 'novadax'];

    switch(region) {
      case 'asia': return asiaExchanges.length;
      case 'europe': return europeExchanges.length;
      case 'americas': return americasExchanges.length;
      default: return 0;
    }
  }

  // Get all active exchanges
  getActiveExchanges() {
    return Array.from(this.exchanges.keys());
  }

  // Get specific exchange
  getExchange(name) {
    return this.exchanges.get(name);
  }

  // Fetch tickers from all exchanges
  async fetchAllTickers(symbols = []) {
    const results = new Map();
    const promises = [];

    for (const [exchangeName, exchange] of this.exchanges) {
      promises.push(
        exchange.getTickers(symbols)
          .then(tickers => {
            results.set(exchangeName, tickers);
            console.log(`✅ ${exchangeName}: ${tickers.length} tickers fetched`);
          })
          .catch(error => {
            console.error(`❌ ${exchangeName} failed:`, error.message);
            results.set(exchangeName, []);
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  // Fetch specific symbol from all exchanges
  async fetchSymbolFromAllExchanges(symbol) {
    const results = [];
    const promises = [];

    for (const [exchangeName, exchange] of this.exchanges) {
      promises.push(
        exchange.getTickers([symbol])
          .then(tickers => {
            if (tickers.length > 0) {
              results.push(tickers[0]);
            }
          })
          .catch(error => {
            console.error(`❌ ${exchangeName} failed for ${symbol}:`, error.message);
          })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  // Calculate Volume Weighted Average Price (VWAP)
  calculateVWAP(tickers) {
    if (!tickers || tickers.length === 0) {
      return null;
    }

    let totalValue = 0;
    let totalVolume = 0;

    for (const ticker of tickers) {
      if (ticker.price && ticker.volume && ticker.volume > 0) {
        totalValue += ticker.price * ticker.volume;
        totalVolume += ticker.volume;
      }
    }

    if (totalVolume === 0) {
      return null;
    }

    return {
      vwap: totalValue / totalVolume,
      totalVolume,
      totalValue,
      exchangeCount: tickers.length,
      exchanges: tickers.map(t => t.exchange),
      timestamp: Date.now()
    };
  }

  // Get VWAP for a specific symbol
  async getSymbolVWAP(symbol) {
    const tickers = await this.fetchSymbolFromAllExchanges(symbol);
    return this.calculateVWAP(tickers);
  }

  // Health check for all exchanges
  async healthCheck() {
    const health = {};

    for (const [exchangeName, exchange] of this.exchanges) {
      try {
        const startTime = Date.now();
        await exchange.getTickers(['BTCUSDT']); // Test with BTC
        const responseTime = Date.now() - startTime;

        health[exchangeName] = {
          status: 'healthy',
          responseTime: `${responseTime}ms`,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        health[exchangeName] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }

    return health;
  }
}

module.exports = ExchangeManager;