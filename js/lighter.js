// Lighter API client
// Endpoint: https://mainnet.zklighter.elliot.ai/api/v1/funding-rates
// Returns rates from binance, bybit, hyperliquid, and lighter exchanges
// Lighter has ZERO trading fees

const LIGHTER_API = "https://mainnet.zklighter.elliot.ai/api/v1";

function getNumber(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function fetchLighterFundingRates() {
  const res = await fetch(`${LIGHTER_API}/funding-rates`);
  if (!res.ok) throw new Error("Lighter funding rates request failed");
  const data = await res.json();
  const rates = data?.funding_rates || [];

  // Filter to only lighter exchange rates
  const lighterRates = rates.filter((r) => r.exchange === "lighter");

  return lighterRates.map((item) => ({
    symbol: item.symbol,
    base: item.symbol,
    rate8h: getNumber(item.rate),
    marketId: item.market_id,
  }));
}

export async function fetchLighterTickers() {
  const res = await fetch(`${LIGHTER_API}/tickers`);
  if (!res.ok) return new Map();
  const data = await res.json();
  const tickers = data?.tickers || [];
  const map = new Map();
  tickers.forEach((t) => {
    map.set(t.symbol || t.market_id, {
      openInterest: getNumber(t.open_interest_usd || t.openInterest || 0),
      markPrice: getNumber(t.mark_price || t.markPx || 0),
    });
  });
  return map;
}
