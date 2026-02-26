import { fetchOrderlyFundingRates } from "./orderly.js";
import { fetchHyperliquidMeta, parseHyperliquidFunding } from "./hyperliquid.js";
import { initCalculator, updateCalculatorPairs } from "./calculator.js";
// Note: Both Orderly and Hyperliquid funding rates are per 8h interval
// Orderly: 3 intervals/day (every 8h), Hyperliquid: 3 intervals/day (every 8h)

const DEX_URL = "https://dex.defiyield.live";
const HL_REF_URL = "https://app.hyperliquid.xyz/join/DEFIYIELD";
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

const sortState = {
  key: "apy",
  dir: "desc",
};

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
    const [orderlyRates, hyperMeta] = await Promise.all([
      fetchOrderlyFundingRates(),
      fetchHyperliquidMeta(),
    ]);
    const hyperRates = parseHyperliquidFunding(hyperMeta);
    const combined = matchPairs(orderlyRates, hyperRates);
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

function matchPairs(orderlyRates, hyperRates) {
  const hyperMap = new Map();
  hyperRates.forEach((item) => hyperMap.set(item.base, item));

  return orderlyRates
    .map((orderly) => {
      const hyper = hyperMap.get(orderly.base);
      if (!hyper) return null;
      const orderlyAnnual = annualizeFrom8h(orderly.rate8h);
      const hyperAnnual = annualizeFrom8h(hyper.rate8h);
      const spread = orderlyAnnual - hyperAnnual;
      const oiOrderly = orderly.openInterest || 0;
      const oiHyper = hyper.openInterest || 0;
      const oiMin = Math.min(oiOrderly, oiHyper);
      return {
        asset: orderly.base,
        symbol: orderly.symbol,
        orderlyAnnual,
        hyperAnnual,
        spread,
        apy: Math.abs(spread),
        oiOrderly,
        oiHyper,
        oiMin,
      };
    })
    .filter(Boolean);
}

function renderTable(rows) {
  elements.fundingBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.className = "refresh-animate";
    const tradeUrl = `${DEX_URL}/perp/${row.symbol}`;
    tr.innerHTML = `
      <td><strong>${row.asset}</strong></td>
      <td>${formatPercent(row.orderlyAnnual)}</td>
      <td>${formatPercent(row.hyperAnnual)}</td>
      <td class="${row.spread >= 0 ? "positive" : "negative"}">${formatPercent(row.spread)}</td>
      <td>${formatPercent(row.apy)}</td>
      <td class="oi-cell"><span class="oi-label">O:</span> ${formatCompact(row.oiOrderly)} <span class="oi-label">H:</span> ${formatCompact(row.oiHyper)}</td>
      <td>
        <a href="${tradeUrl}" target="_blank" rel="noreferrer" class="trade-btn">Orderly</a>
        <a href="${HL_REF_URL}" target="_blank" rel="noreferrer" class="trade-btn hl-btn">HL</a>
      </td>
    `;
    elements.fundingBody.appendChild(tr);
  });
}

function renderTopCards(rows) {
  elements.topCards.innerHTML = "";
  const top = [...rows]
    .sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread))
    .slice(0, 5);

  top.forEach((row) => {
    const card = document.createElement("div");
    card.className = "card refresh-animate";
    const direction = row.spread >= 0
      ? "Short Orderly · Long Hyperliquid"
      : "Short Hyperliquid · Long Orderly";
    const estOn10k = (10_000 * (row.apy / 100)).toFixed(0);
    const tradeUrl = `${DEX_URL}/perp/${row.symbol}`;

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${row.asset}</h3>
        <span class="badge">${formatPercent(row.apy)} APY</span>
      </div>
      <p><span class="badge direction">${direction}</span></p>
      <p>Orderly: ${formatPercent(row.orderlyAnnual)} · Hyperliquid: ${formatPercent(row.hyperAnnual)}</p>
      <p class="neutral">$${estOn10k}/yr on $10k · OI: ${formatCompact(row.oiMin)} (min)</p>
      <a href="${tradeUrl}" target="_blank" rel="noreferrer" class="trade-link">Orderly DEX →</a>
      <a href="${HL_REF_URL}" target="_blank" rel="noreferrer" class="trade-link hl-link">Hyperliquid →</a>
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
  const best = rows.reduce((acc, item) =>
    Math.abs(item.spread) > Math.abs(acc.spread) ? item : acc
  );
  elements.bestSpread.textContent = `${best.asset} ${formatPercent(best.spread)}`;
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
    if (sortState.key === "orderly") return (a.orderlyAnnual - b.orderlyAnnual) * factor;
    if (sortState.key === "hyperliquid") return (a.hyperAnnual - b.hyperAnnual) * factor;
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
