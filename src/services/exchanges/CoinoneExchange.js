const BaseExchange = require('./BaseExchange');

class CoinoneExchange extends BaseExchange {
  constructor() {
    super({
      name: 'coinone',
      baseURL: 'https://api.coinone.co.kr',
      rateLimit: 167 // 167ms between requests (360/min limit)
    });
  }

  async getTickers(symbols = []) {
    try {
      const endpoint = '/ticker?currency=all';
      const data = await this.makeRequest(endpoint);

      if (data.result !== 'success') {
        throw new Error(`Coinone API error: ${data.errorCode}`);
      }

      const tickers = [];
      for (const [currency, ticker] of Object.entries(data)) {
        if (currency === 'result' || currency === 'errorCode') continue;

        // Filter by symbols if specified
        if (symbols.length > 0) {
          const coinoneSymbols = symbols.map(s => this.normalizeSymbol(s));
          if (!coinoneSymbols.includes(currency.toUpperCase())) {
            continue;
          }
        }

        tickers.push(this.standardizeTicker({
          ...ticker,
          currency: currency
        }));
      }

      return tickers;
    } catch (error) {
      console.error(`Coinone API error:`, error.message);
      throw new Error(`Failed to fetch tickers from Coinone: ${error.message}`);
    }
  }

  async getOrderBook(symbol, limit = 50) {
    try {
      const coinoneSymbol = this.normalizeSymbol(symbol);
      const endpoint = `/orderbook?currency=${coinoneSymbol}`;

      const data = await this.makeRequest(endpoint);

      if (data.result !== 'success') {
        throw new Error(`Coinone orderbook error: ${data.errorCode}`);
      }

      return {
        symbol,
        exchange: this.name,
        bids: data.bid.slice(0, limit).map(bid => ({
          price: parseFloat(bid.price),
          quantity: parseFloat(bid.qty)
        })),
        asks: data.ask.slice(0, limit).map(ask => ({
          price: parseFloat(ask.price),
          quantity: parseFloat(ask.qty)
        })),
        timestamp: parseInt(data.timestamp) * 1000
      };
    } catch (error) {
      console.error(`Coinone order book error:`, error.message);
      throw error;
    }
  }

  normalizeSymbol(symbol) {
    // BTC/KRW -> BTC
    if (symbol.includes('/')) {
      const [base] = symbol.split('/');
      return base.toUpperCase();
    } else if (symbol.endsWith('KRW')) {
      return symbol.replace('KRW', '').toUpperCase();
    }
    return symbol.toUpperCase();
  }

  standardizeTicker(ticker) {
    const price = parseFloat(ticker.last);
    const yesterday = parseFloat(ticker.yesterday_last);
    const change = price - yesterday;
    const changePercent = yesterday > 0 ? (change / yesterday) * 100 : 0;

    return {
      symbol: this.denormalizeSymbol(ticker.currency),
      price: price,
      volume: parseFloat(ticker.volume),
      high: parseFloat(ticker.high),
      low: parseFloat(ticker.low),
      change: change,
      changePercent: changePercent,
      open: yesterday,
      bid: parseFloat(ticker.last), // Coinone doesn't provide separate bid/ask
      ask: parseFloat(ticker.last),
      timestamp: Date.now(),
      exchange: this.name
    };
  }

  denormalizeSymbol(coinoneSymbol) {
    // BTC -> BTC/KRW
    return `${coinoneSymbol}/KRW`;
  }
}

module.exports = CoinoneExchange;