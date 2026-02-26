export async function fetchHyperliquidMeta() {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
  });
  if (!res.ok) {
    throw new Error("Hyperliquid meta request failed");
  }
  return res.json();
}

export function parseHyperliquidFunding(metaAndCtxs) {
  const [meta, ctxs] = metaAndCtxs || [];
  const universe = meta?.universe || [];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return [];
  return universe.map((item, idx) => {
    const ctx = ctxs[idx] || {};
    return {
      symbol: item?.name,
      base: item?.name,
      rate8h: getNumber(ctx?.funding ?? ctx?.fundingRate ?? ctx?.fundingRatePerHour),
      markPrice: getNumber(ctx?.markPx ?? ctx?.markPrice),
      openInterest: getNumber(ctx?.openInterest) * getNumber(ctx?.markPx ?? ctx?.markPrice),
    };
  });
}

function getNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}
