// Lighter API client
// Returns funding rates from ALL exchanges: binance, bybit, hyperliquid, lighter
// We use this as the unified data source for CEX rates

const LIGHTER_API = "https://mainnet.zklighter.elliot.ai/api/v1";

function getNumber(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function fetchAllFundingRates() {
  const res = await fetch(`${LIGHTER_API}/funding-rates`);
  if (!res.ok) throw new Error("Lighter funding rates request failed");
  const data = await res.json();
  const rates = data?.funding_rates || [];

  // Group by exchange
  const byExchange = {};
  rates.forEach((r) => {
    if (!byExchange[r.exchange]) byExchange[r.exchange] = new Map();
    byExchange[r.exchange].set(r.symbol, {
      symbol: r.symbol,
      base: r.symbol,
      rate8h: getNumber(r.rate),
      marketId: r.market_id,
    });
  });

  return byExchange;
}
