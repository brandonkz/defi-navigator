export async function fetchOrderlyFundingRates() {
  const [ratesRes, futuresRes] = await Promise.all([
    fetch("https://api-evm.orderly.org/v1/public/funding_rates"),
    fetch("https://api-evm.orderly.org/v1/public/futures"),
  ]);
  if (!ratesRes.ok) throw new Error("Orderly funding rates request failed");
  const ratesData = await ratesRes.json();
  const list = ratesData?.data?.rows || (Array.isArray(ratesData?.data) ? ratesData.data : []);

  // Get OI from futures endpoint
  const oiMap = new Map();
  if (futuresRes.ok) {
    const futuresData = await futuresRes.json();
    const futures = futuresData?.data?.rows || (Array.isArray(futuresData?.data) ? futuresData.data : []);
    futures.forEach((f) => {
      const sym = f.symbol || f.instrument_id || "";
      oiMap.set(sym, getNumber(f.open_interest ?? f.openInterest ?? 0));
    });
  }

  return list.map((item) => {
    const symbol = item.symbol || item.instrument_id || item.market;
    return {
      symbol,
      base: normalizeOrderlySymbol(symbol),
      rate8h: getNumber(item.last_funding_rate ?? item.est_funding_rate ?? item.funding_rate ?? item.fundingRate ?? item.rate),
      openInterest: oiMap.get(symbol) || 0,
    };
  });
}

export async function fetchOrderlyInfo() {
  const res = await fetch("https://api-evm.orderly.org/v1/public/info");
  if (!res.ok) {
    throw new Error("Orderly info request failed");
  }
  return res.json();
}

export async function fetchOrderlyFutures() {
  const res = await fetch("https://api-evm.orderly.org/v1/public/futures");
  if (!res.ok) {
    throw new Error("Orderly futures request failed");
  }
  return res.json();
}

function normalizeOrderlySymbol(symbol = "") {
  if (!symbol) return "";
  if (symbol.includes("PERP_")) {
    const parts = symbol.split("_");
    return parts[1] || symbol;
  }
  if (symbol.includes("-")) {
    return symbol.split("-")[0].replace("USDT", "").replace("USDC", "");
  }
  if (symbol.includes("/")) {
    return symbol.split("/")[0];
  }
  return symbol.replace("PERP", "").replace("_USDC", "").replace("USDC", "");
}

function getNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
