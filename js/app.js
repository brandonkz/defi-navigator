import { fetchOrderlyFundingRates } from "./orderly.js";
import { fetchHyperliquidMeta, parseHyperliquidFunding } from "./hyperliquid.js";
import { fetchLighterFundingRates } from "./lighter.js";
import { initCalculator, updateCalculatorPairs } from "./calculator.js";

// All three exchanges use 8h funding intervals (3x/day)
// Lighter has ZERO trading fees — best leg for any delta-neutral pair

const DEX_URL = "https://dex.defiyield.live";
const HL_REF_URL = "https://app.hyperliquid.xyz/join/DEFIYIELD";
const LIGHTER_URL = "https://app.lighter.xyz/trade";
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
    elements.refreshStatus.textContent = "Refreshing…";
    const [orderlyRates, hyperMeta, lighterRates] = await Promise.all([
      fetchOrderlyFundingRates(),
      fetchHyperliquidMeta(),
      fetchLighterFundingRates(),
    ]);
    const hyperRates = parseHyperliquidFunding(hyperMeta);
    const combined = buildOpportunities(orderlyRates, hyperRates, lighterRates);
    const sorted = sortPairs(combined);

    renderTable(sorted);
    renderTopCards(sorted);
    updateSummary(sorted);
    updateCalculatorPairs(elements.pairSelect, sorted);

    elements.lastRefresh.textContent = new Date().toLocaleTimeString();
    elements.refreshStatus.textContent = `Auto-refresh: ${REFRESH_MS / 1000}s`;
  } catch (error) {
    elements.refreshStatus.textContent = "Refresh failed — retrying…";
    console.error("Refresh error:", error);
  }
}

function buildOpportunities(orderlyRates, hyperRates, lighterRates) {
  // Build maps by asset name
  const orderlyMap = new Map();
  orderlyRates.forEach((r) => orderlyMap.set(r.base, r));
  const hyperMap = new Map();
  hyperRates.forEach((r) => hyperMap.set(r.base, r));
  const lighterMap = new Map();
  lighterRates.forEach((r) => lighterMap.set(r.base, r));

  // Get all unique assets present on at least 2 exchanges
  const allAssets = new Set([
    ...orderlyMap.keys(),
    ...hyperMap.keys(),
    ...lighterMap.keys(),
  ]);

  const results = [];

  allAssets.forEach((asset) => {
    const o = orderlyMap.get(asset);
    const h = hyperMap.get(asset);
    const l = lighterMap.get(asset);

    const exchanges = [];
    if (o) exchanges.push({ name: "Orderly", rate: o.rate8h, annual: annualizeFrom8h(o.rate8h), oi: o.openInterest || 0, symbol: o.symbol });
    if (h) exchanges.push({ name: "Hyperliquid", rate: h.rate8h, annual: annualizeFrom8h(h.rate8h), oi: h.openInterest || 0 });
    if (l) exchanges.push({ name: "Lighter", rate: l.rate8h, annual: annualizeFrom8h(l.rate8h), oi: 0, zeroFees: true });

    if (exchanges.length < 2) return;

    // Find best spread: highest rate (short) vs lowest rate (long)
    exchanges.sort((a, b) => b.annual - a.annual);
    const shortExchange = exchanges[0]; // highest funding = short here, collect
    const longExchange = exchanges[exchanges.length - 1]; // lowest = long here

    const spread = shortExchange.annual - longExchange.annual;
    if (Math.abs(spread) < 0.5) return; // skip tiny spreads

    const oiMin = Math.min(
      ...exchanges.filter((e) => e.oi > 0).map((e) => e.oi),
      Infinity
    );

    results.push({
      asset,
      symbol: o?.symbol || `PERP_${asset}_USDC`,
      exchanges,
      shortExchange,
      longExchange,
      spread,
      apy: Math.abs(spread),
      oiMin: oiMin === Infinity ? 0 : oiMin,
      orderlyAnnual: o ? annualizeFrom8h(o.rate8h) : null,
      hyperAnnual: h ? annualizeFrom8h(h.rate8h) : null,
      lighterAnnual: l ? annualizeFrom8h(l.rate8h) : null,
    });
  });

  return results;
}

function renderTable(rows) {
  elements.fundingBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "refresh-animate";
    const tradeUrl = `${DEX_URL}/perp/${row.symbol}`;
    const feeNote = row.shortExchange.zeroFees || row.longExchange.zeroFees ? ' <span class="zero-fee">0% FEE</span>' : "";

    tr.innerHTML = `
      <td><strong>${row.asset}</strong></td>
      <td>${row.orderlyAnnual !== null ? formatPercent(row.orderlyAnnual) : '<span class="neutral">—</span>'}</td>
      <td>${row.hyperAnnual !== null ? formatPercent(row.hyperAnnual) : '<span class="neutral">—</span>'}</td>
      <td>${row.lighterAnnual !== null ? formatPercent(row.lighterAnnual) : '<span class="neutral">—</span>'}</td>
      <td class="${row.spread >= 0 ? "positive" : "negative"}">${formatPercent(row.apy)}${feeNote}</td>
      <td class="strategy-cell">
        <span class="short-label">S</span> ${row.shortExchange.name}
        <span class="long-label">L</span> ${row.longExchange.name}
      </td>
      <td class="oi-cell">${row.oiMin > 0 ? formatCompact(row.oiMin) : '<span class="neutral">—</span>'}</td>
      <td>
        ${row.orderlyAnnual !== null ? `<a href="${tradeUrl}" target="_blank" rel="noreferrer" class="trade-btn">O</a>` : ""}
        <a href="${HL_REF_URL}" target="_blank" rel="noreferrer" class="trade-btn hl-btn">HL</a>
        <a href="${LIGHTER_URL}/${row.asset}" target="_blank" rel="noreferrer" class="trade-btn lighter-btn">L</a>
      </td>
    `;
    elements.fundingBody.appendChild(tr);
  });
}

function renderTopCards(rows) {
  elements.topCards.innerHTML = "";
  const top = [...rows]
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 5);

  top.forEach((row) => {
    const card = document.createElement("div");
    card.className = "card refresh-animate";
    const estOn10k = (10_000 * (row.apy / 100)).toFixed(0);
    const tradeUrl = `${DEX_URL}/perp/${row.symbol}`;
    const hasFreeleg = row.shortExchange.zeroFees || row.longExchange.zeroFees;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${row.asset}</h3>
        <span class="badge">${formatPercent(row.apy)} APY</span>
      </div>
      <p>
        <span class="badge direction">Short ${row.shortExchange.name} · Long ${row.longExchange.name}</span>
        ${hasFreeleg ? '<span class="badge zero-fee-badge">0% FEE LEG</span>' : ""}
      </p>
      <p class="rates-line">
        ${row.exchanges.map((e) => `${e.name}: ${formatPercent(e.annual)}`).join(" · ")}
      </p>
      <p class="neutral">$${estOn10k}/yr on $10k${row.oiMin > 0 ? ` · OI: ${formatCompact(row.oiMin)}` : ""}</p>
      <div class="card-links">
        <a href="${tradeUrl}" target="_blank" rel="noreferrer" class="trade-link">Orderly →</a>
        <a href="${HL_REF_URL}" target="_blank" rel="noreferrer" class="trade-link hl-link">Hyperliquid →</a>
        <a href="${LIGHTER_URL}/${row.asset}" target="_blank" rel="noreferrer" class="trade-link lighter-link">Lighter →</a>
      </div>
    `;
    elements.topCards.appendChild(card);
  });
}

function updateSummary(rows) {
  elements.matchedCount.textContent = rows.length.toString();
  if (!rows.length) {
    elements.bestSpread.textContent = "—";
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
    if (sortState.key === "orderly") return ((a.orderlyAnnual || 0) - (b.orderlyAnnual || 0)) * factor;
    if (sortState.key === "hyperliquid") return ((a.hyperAnnual || 0) - (b.hyperAnnual || 0)) * factor;
    if (sortState.key === "lighter") return ((a.lighterAnnual || 0) - (b.lighterAnnual || 0)) * factor;
    if (sortState.key === "apy") return (a.apy - b.apy) * factor;
    if (sortState.key === "oi") return (a.oiMin - b.oiMin) * factor;
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
