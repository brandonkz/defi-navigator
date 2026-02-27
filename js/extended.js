// Extended Exchange (Starknet) - Funding Rate Client
// Hybrid CLOB on Starknet - api.starknet.extended.exchange
// Note: API may not support CORS from browser — fails gracefully if blocked

export const Extended = {
  BASE_URL: 'https://api.starknet.extended.exchange',
  INTERVAL_HOURS: 8,

  async getFundingRates() {
    try {
      const resp = await fetch(`${this.BASE_URL}/api/v1/info/markets`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) return {};
      const markets = await resp.json();
      if (!Array.isArray(markets)) return {};

      const rates = {};
      for (const m of markets) {
        if (!m.active || m.status !== 'ACTIVE') continue;
        const asset = m.assetName;
        const stats = m.marketStats || {};
        const rate8h = parseFloat(stats.fundingRate || 0);
        if (!asset || isNaN(rate8h)) continue;

        rates[asset] = {
          base: asset,
          symbol: m.name,
          rate8h,
          rateAnnualized: rate8h * 3 * 365 * 100,
          markPrice: parseFloat(stats.markPrice || 0),
          openInterest: parseFloat(stats.openInterest || 0),
          exchange: 'Extended',
        };
      }
      return rates;
    } catch (e) {
      // Fail silently — CORS or network issue
      console.warn('Extended API unavailable (likely CORS):', e.message);
      return {};
    }
  }
};
