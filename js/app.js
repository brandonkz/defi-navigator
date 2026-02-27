import { fetchOrderlyFundingRates } from "./orderly.js";
import { fetchAllFundingRates } from "./lighter.js";
import { initCalculator, updateCalculatorPairs } from "./calculator.js";
import { Extended } from "./extended.js";

// All exchanges use 8h funding intervals
// Lighter = zero fees, CEXs shown for reference

const TRADE_URLS = {
  Orderly: (symbol) => `https://dex.defiyield.live/perp/${symbol}`,
  Hyperliquid: () => "https://app.hyperliquid.xyz/join/DEFIYIELD",
  Lighter: (asset) => `https://app.lighter.xyz/trade/${asset}?referral=WWYWM1B1P19D`,
  Extended: (asset) => `https://extended.exchange/trade/${asset}-USD`,
  Binance: (asset) => `https://www.binance.com/en/futures/${asset}USDT`,
  Bybit: (asset) => `https://www.bybit.com/trade/usdt/${asset}USDT`,
};

const EXCHANGE_META = {
  Orderly:    { color: "gold",   label: "O",   css: "orderly-btn",  fees: "~0.04%", type: "DEX" },
  Hyperliquid:{ color: "teal",   label: "HL",  css: "hl-btn",       fees: "~0.04%", type: "DEX" },
  Lighter:    { color: "purple", label: "L",   css: "lighter-btn",  fees: "0%",     type: "DEX" },
  Extended:   { color: "blue",   label: "EX",  css: "extended-btn", fees: "~0.02%", type: "DEX" },
  Binance:    { color: "yellow", label: "B",   css: "binance-btn",  fees: "~0.02%", type: "CEX" },
  Bybit:      { color: "orange", label: "By",  css: "bybit-btn",    fees: "~0.04%", type: "CEX" },
};

const EXCHANGE_ORDER = ["Orderly", "Hyperliquid", "Lighter", "Extended", "Binance", "Bybit"];
const REFRESH_MS = 60_000;

const elements = {
  matchedCount: document.getElementById("matchedCount"),
  bestSpread: document.getElementById("bestSpread"),
  lastRefresh: document.getElementById("lastRefresh"),
  fundingBody: document.getElementById("fundingBody"),
  refreshBtn: document.getElementById("refreshBtn"),
  refreshStatus: document.getElementById("refreshStatus"),
  topCards: document.getElementById("topCards"),
  pairSelect: document.getElementById("pairSelect"),
  calcBtn: document.getElementById("calcBtn"),
  capitalInput: document.getElementById("capitalInput"),
  feeInput: document.getElementById("feeInput"),
  calcResults: document.getElementById("calcResults"),
};

const sortState = { key: "apy", dir: "desc" };

initCalculator({
  pairSelect: elements.pairSelect,
  calcBtn: elements.calcBtn,
  capitalInput: elements.capitalInput,
  feeInput: elements.feeInput,
  results: elements.calcResults,
});

setupSorting();

async function refreshAll() {
  try {
    elements.refreshStatus.textContent = "Refreshing\u2026";

    // Fetch Orderly directly (not in Lighter's aggregator) + all from Lighter API + Extended
    const [orderlyRates, allRates, extendedRates] = await Promise.all([
      fetchOrderlyFundingRates(),
      fetchAllFundingRates(),
      Extended.getFundingRates(),
    ]);

    // Build unified map: exchange -> asset -> rate data
    const unified = {};

    // Orderly from direct API (more accurate OI)
    const orderlyMap = new Map();
    orderlyRates.forEach((r) => orderlyMap.set(r.base, r));
    unified["Orderly"] = orderlyMap;

    // From Lighter aggregator
    if (allRates.hyperliquid) unified["Hyperliquid"] = allRates.hyperliquid;
    if (allRates.lighter) unified["Lighter"] = allRates.lighter;
    if (allRates.binance) unified["Binance"] = allRates.binance;
    if (allRates.bybit) unified["Bybit"] = allRates.bybit;

    // Extended (Starknet hybrid CLOB)
    const extendedMap = new Map();
    Object.entries(extendedRates).forEach(([asset, data]) => {
      extendedMap.set(asset, {
        base: asset,
        symbol: data.symbol,
        rate8h: data.rate8h,
        openInterest: data.openInterest,
      });
    });
    if (extendedMap.size > 0) unified["Extended"] = extendedMap;

    const combined = buildOpportunities(unified);
    const sorted = sortPairs(combined);

    renderTable(sorted);
    renderTopCards(sorted);
    updateSummary(sorted);
    updateCalculatorPairs(elements.pairSelect, sorted);

    elements.lastRefresh.textContent = new Date().toLocaleTimeString();
    elements.refreshStatus.textContent = `Auto-refresh: ${REFRESH_MS / 1000}s`;
  } catch (error) {
    elements.refreshStatus.textContent = "Refresh failed \u2014 retrying\u2026";
    console.error("Refresh error:", error);
  }
}

function buildOpportunities(unified) {
  // Collect all unique assets
  const allAssets = new Set();
  Object.values(unified).forEach((map) => {
    map.forEach((_, key) => allAssets.add(key));
  });

  const results = [];

  allAssets.forEach((asset) => {
    const exchanges = [];

    EXCHANGE_ORDER.forEach((exName) => {
      const map = unified[exName];
      if (!map) return;
      const data = map.get(asset);
      if (!data) return;
      exchanges.push({
        name: exName,
        rate: data.rate8h,
        annual: annualizeFrom8h(data.rate8h),
        oi: data.openInterest || 0,
        symbol: data.symbol,
        zeroFees: exName === "Lighter",
        type: EXCHANGE_META[exName]?.type || "DEX",
      });
    });

    if (exchanges.length < 2) return;

    // Find best spread: highest funding (short) vs lowest funding (long)
    const sorted = [...exchanges].sort((a, b) => b.annual - a.annual);
    const shortEx = sorted[0];
    const longEx = sorted[sorted.length - 1];
    const spread = shortEx.annual - longEx.annual;

    if (spread < 0.5) return; // skip tiny spreads

    const oiValues = exchanges.filter((e) => e.oi > 0).map((e) => e.oi);
    const oiMin = oiValues.length ? Math.min(...oiValues) : 0;

    // Get Orderly symbol for trade links
    const orderlyData = unified["Orderly"]?.get(asset);
    const orderlySymbol = orderlyData?.symbol || `PERP_${asset}_USDC`;

    // Build rate lookup
    const rateByExchange = {};
    exchanges.forEach((e) => { rateByExchange[e.name] = e.annual; });

    results.push({
      asset,
      symbol: orderlySymbol,
      exchanges,
      rateByExchange,
      shortExchange: shortEx,
      longExchange: longEx,
      spread,
      apy: spread,
      oiMin,
    });
  });

  return results;
}

function renderTable(rows) {
  elements.fundingBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "refresh-animate";

    const rateCell = (exName) => {
      const val = row.rateByExchange[exName];
      if (val === undefined) return '<span class="neutral">\u2014</span>';
      const cls = val > 0 ? "positive" : val < 0 ? "negative" : "neutral";
      return `<span class="${cls}">${formatPercent(val)}</span>`;
    };

    const feeNote = row.shortExchange.zeroFees || row.longExchange.zeroFees
      ? ' <span class="zero-fee">0% FEE</span>'
      : "";

    // Build trade buttons
    const tradeButtons = row.exchanges.map((e) => {
      const meta = EXCHANGE_META[e.name];
      const url = e.name === "Orderly"
        ? TRADE_URLS.Orderly(row.symbol)
        : TRADE_URLS[e.name](row.asset);
      return `<a href="${url}" target="_blank" rel="noreferrer" class="trade-btn ${meta.css}">${meta.label}</a>`;
    }).join("");

    tr.innerHTML = `
      <td><strong>${row.asset}</strong></td>
      <td>${rateCell("Orderly")}</td>
      <td>${rateCell("Hyperliquid")}</td>
      <td>${rateCell("Lighter")}</td>
      <td>${rateCell("Binance")}</td>
      <td>${rateCell("Bybit")}</td>
      <td class="positive">${formatPercent(row.apy)}${feeNote}</td>
      <td class="strategy-cell">
        <span class="short-label">S</span> ${row.shortExchange.name}
        <span class="long-label">L</span> ${row.longExchange.name}
      </td>
      <td class="oi-cell">${row.oiMin > 0 ? formatCompact(row.oiMin) : '<span class="neutral">\u2014</span>'}</td>
      <td class="trade-cell">${tradeButtons}</td>
    `;
    elements.fundingBody.appendChild(tr);
  });
}

function renderTopCards(rows) {
  elements.topCards.innerHTML = "";
  const top = [...rows].sort((a, b) => b.apy - a.apy).slice(0, 5);

  top.forEach((row) => {
    const card = document.createElement("div");
    card.className = "card refresh-animate";
    const estOn10k = (10_000 * (row.apy / 100)).toFixed(0);
    const hasFreeleg = row.shortExchange.zeroFees || row.longExchange.zeroFees;

    const ratesText = row.exchanges
      .map((e) => `${e.name}: ${formatPercent(e.annual)}`)
      .join(" \u00b7 ");

    // Trade links for short + long exchanges only
    const shortUrl = row.shortExchange.name === "Orderly"
      ? TRADE_URLS.Orderly(row.symbol)
      : TRADE_URLS[row.shortExchange.name](row.asset);
    const longUrl = row.longExchange.name === "Orderly"
      ? TRADE_URLS.Orderly(row.symbol)
      : TRADE_URLS[row.longExchange.name](row.asset);

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${row.asset}</h3>
        <span class="badge">${formatPercent(row.apy)} APY</span>
      </div>
      <p>
        <span class="badge direction">Short ${row.shortExchange.name} \u00b7 Long ${row.longExchange.name}</span>
        ${hasFreeleg ? '<span class="badge zero-fee-badge">0% FEE LEG</span>' : ""}
      </p>
      <p class="rates-line">${ratesText}</p>
      <p class="neutral">$${estOn10k}/yr on $10k${row.oiMin > 0 ? ` \u00b7 OI: ${formatCompact(row.oiMin)}` : ""}</p>
      <div class="card-links">
        <a href="${shortUrl}" target="_blank" rel="noreferrer" class="trade-link">Short ${row.shortExchange.name} \u2192</a>
        <a href="${longUrl}" target="_blank" rel="noreferrer" class="trade-link">Long ${row.longExchange.name} \u2192</a>
      </div>
    `;
    elements.topCards.appendChild(card);
  });
}

function updateSummary(rows) {
  elements.matchedCount.textContent = rows.length.toString();
  if (!rows.length) {
    elements.bestSpread.textContent = "\u2014";
    return;
  }
  const best = rows.reduce((acc, item) => item.apy > acc.apy ? item : acc);
  elements.bestSpread.textContent = `${best.asset} ${formatPercent(best.apy)}`;
}

function setupSorting() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.dir = "desc";
      }
      refreshAll();
    });
  });
  elements.refreshBtn.addEventListener("click", refreshAll);
}

function sortPairs(rows) {
  const sorted = [...rows];
  const factor = sortState.dir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    const key = sortState.key;
    if (key === "apy") return (a.apy - b.apy) * factor;
    if (key === "oi") return (a.oiMin - b.oiMin) * factor;
    // Exchange-specific sort
    const exMap = { orderly: "Orderly", hyperliquid: "Hyperliquid", lighter: "Lighter", binance: "Binance", bybit: "Bybit" };
    const exName = exMap[key];
    if (exName) {
      return ((a.rateByExchange[exName] || 0) - (b.rateByExchange[exName] || 0)) * factor;
    }
    return (a.spread - b.spread) * factor;
  });
  return sorted;
}

function annualizeFrom8h(rate) {
  return rate * 3 * 365 * 100;
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompact(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

refreshAll();
setInterval(refreshAll, REFRESH_MS);
