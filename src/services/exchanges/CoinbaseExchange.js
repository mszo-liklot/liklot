const BaseExchange = require('./BaseExchange');

class CoinbaseExchange extends BaseExchange {
  constructor() {
    super({
      name: 'coinbase',
      baseURL: 'https://api.exchange.coinbase.com',
      rateLimit: 20 // 20ms between requests (3000/min limit)
    });
  }

  async getTickers(symbols = null) {
    try {
      await this.waitForRateLimit();

      // Coinbase는 개별 상품 정보를 먼저 가져와야 함
      const productsResponse = await this.makeRequest('/products');
      let products = productsResponse.filter(product =>
        product.status === 'online' &&
        (product.quote_currency === 'USD' || product.quote_currency === 'USDT' || product.quote_currency === 'BTC')
      );

      // 심볼 필터링
      if (symbols && symbols.length > 0) {
        const coinbaseSymbols = symbols.map(s => this.normalizeSymbolForCoinbase(s));
        products = products.filter(product =>
          coinbaseSymbols.includes(product.id)
        );
      }

      if (products.length === 0) {
        return [];
      }

      // 24hr stats 가져오기
      const statsResponse = await this.makeRequest('/products/stats');

      const tickers = [];
      for (const product of products) {
        try {
          // 개별 티커 정보 가져오기
          const tickerUrl = `/products/${product.id}/ticker`;
          const ticker = await this.makeRequest(tickerUrl);

          // 24hr stats 찾기
          const stats = statsResponse[product.id] || {};

          tickers.push(this.standardizeTicker({
            ...ticker,
            product_id: product.id,
            stats: stats,
            base_currency: product.base_currency,
            quote_currency: product.quote_currency
          }));

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
          console.warn(`Failed to get ticker for ${product.id}:`, error.message);
        }
      }

      return tickers;

    } catch (error) {
      console.error('Coinbase API error:', error.message);
      throw error;
    }
  }

  async getOrderBook(symbol, limit = 20) {
    try {
      await this.waitForRateLimit();

      const coinbaseSymbol = this.normalizeSymbolForCoinbase(symbol);
      const url = `/products/${coinbaseSymbol}/book?level=2`;

      const data = await this.makeRequest(url);

      return {
        symbol: symbol,
        bids: data.bids.slice(0, limit).map(bid => ({
          price: parseFloat(bid[0]),
          amount: parseFloat(bid[1])
        })),
        asks: data.asks.slice(0, limit).map(ask => ({
          price: parseFloat(ask[0]),
          amount: parseFloat(ask[1])
        })),
        timestamp: Date.now()
      };

    } catch (error) {
      console.error(`Coinbase orderbook error for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getKlines(symbol, interval = '1m', limit = 100) {
    try {
      await this.waitForRateLimit();

      const coinbaseSymbol = this.normalizeSymbolForCoinbase(symbol);
      const granularity = this.normalizeInterval(interval);

      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (limit * granularity);

      const url = `/products/${coinbaseSymbol}/candles?start=${startTime}&end=${endTime}&granularity=${granularity}`;

      const data = await this.makeRequest(url);

      return data.reverse().map(candle => ({
        openTime: candle[0] * 1000,
        low: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        open: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: (candle[0] + granularity) * 1000 - 1,
        quoteVolume: parseFloat(candle[5]) * parseFloat(candle[4]),
        trades: 0,
        baseAssetVolume: parseFloat(candle[5]),
        quoteAssetVolume: parseFloat(candle[5]) * parseFloat(candle[4])
      }));

    } catch (error) {
      console.error(`Coinbase klines error for ${symbol}:`, error.message);
      throw error;
    }
  }

  standardizeTicker(ticker) {
    const stats = ticker.stats || {};

    return {
      symbol: this.denormalizeSymbol(ticker.product_id),
      price: parseFloat(ticker.price || 0),
      high: parseFloat(stats.high || ticker.price || 0),
      low: parseFloat(stats.low || ticker.price || 0),
      volume: parseFloat(stats.volume || 0),
      quoteVolume: parseFloat(stats.volume || 0) * parseFloat(ticker.price || 0),
      open: parseFloat(stats.open || ticker.price || 0),
      change: parseFloat(ticker.price || 0) - parseFloat(stats.open || ticker.price || 0),
      changePercent: stats.open ? ((parseFloat(ticker.price) - parseFloat(stats.open)) / parseFloat(stats.open)) * 100 : 0,
      bid: parseFloat(ticker.bid || 0),
      ask: parseFloat(ticker.ask || 0),
      timestamp: new Date(ticker.time).getTime()
    };
  }

  normalizeSymbolForCoinbase(symbol) {
    // BTC/USD → BTC-USD
    // BTCUSDT → BTC-USDT
    if (symbol.includes('/')) {
      return symbol.replace('/', '-');
    } else if (symbol.endsWith('USDT')) {
      const base = symbol.replace('USDT', '');
      return `${base}-USDT`;
    } else if (symbol.endsWith('USD')) {
      const base = symbol.replace('USD', '');
      return `${base}-USD`;
    } else if (symbol.endsWith('BTC')) {
      const base = symbol.replace('BTC', '');
      return `${base}-BTC`;
    }

    // 이미 Coinbase 형식인 경우
    if (symbol.includes('-')) {
      return symbol;
    }

    return `${symbol}-USD`;
  }

  denormalizeSymbol(coinbaseSymbol) {
    // BTC-USD → BTC/USD
    return coinbaseSymbol.replace('-', '/');
  }

  normalizeInterval(interval) {
    const intervalMap = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '6h': 21600,
      '1d': 86400
    };

    return intervalMap[interval] || 60;
  }
}

module.exports = CoinbaseExchange;