// Extended Exchange (Starknet) - Funding Rate Client
// Hybrid CLOB on Starknet - api.starknet.extended.exchange

const Extended = {
  BASE_URL: 'https://api.starknet.extended.exchange',
  INTERVAL_HOURS: 8, // 8-hour funding intervals

  // Fetch all markets and extract funding rates
  async getFundingRates() {
    try {
      const resp = await fetch(`${this.BASE_URL}/api/v1/info/markets`);
      const markets = await resp.json();

      const rates = {};
      for (const m of markets) {
        if (!m.active || m.status !== 'ACTIVE') continue;

        const asset = m.assetName; // ETH, BTC, SOL etc
        const stats = m.marketStats || {};
        const rate8h = parseFloat(stats.fundingRate || 0);

        rates[asset] = {
          symbol: m.name,           // ETH-USD
          asset,
          rate8h,
          rateAnnualized: rate8h * 3 * 365 * 100, // annualized %
          markPrice: parseFloat(stats.markPrice || 0),
          openInterest: parseFloat(stats.openInterest || 0), // in USD
          nextFunding: stats.nextFundingRate, // unix ms timestamp
          exchange: 'Extended',
          tradeUrl: `https://extended.exchange/trade/${m.name}`,
        };
      }
      return rates;
    } catch (e) {
      console.error('Extended API error:', e);
      return {};
    }
  },

  // Get funding rate for a specific asset
  async getRate(asset) {
    const rates = await this.getFundingRates();
    return rates[asset] || null;
  },

  // Format OI for display
  formatOI(usdValue) {
    if (usdValue >= 1e9) return `$${(usdValue / 1e9).toFixed(1)}B`;
    if (usdValue >= 1e6) return `$${(usdValue / 1e6).toFixed(1)}M`;
    if (usdValue >= 1e3) return `$${(usdValue / 1e3).toFixed(0)}K`;
    return `$${usdValue.toFixed(0)}`;
  }
};

// Export for use in app.js
if (typeof module !== 'undefined') module.exports = Extended;
