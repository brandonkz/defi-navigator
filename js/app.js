import { fetchOrderlyFundingRates } from "./orderly.js";
import { fetchHyperliquidMeta, parseHyperliquidFunding } from "./hyperliquid.js";
// Note: Both Orderly and Hyperliquid funding rates are per 8h interval
// Orderly: 3 intervals/day (every 8h), Hyperliquid: 3 intervals/day (every 8h)
import { initPositionMonitor, loadPositions } from "./positions.js";
import { initCalculator, updateCalculatorPairs } from "./calculator.js";

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
  orderlyPositions: document.getElementById("orderlyPositions"),
  hyperliquidPositions: document.getElementById("hyperliquidPositions"),
  combinedPositions: document.getElementById("combinedPositions"),
};

const sortState = {
  key: "spread",
  dir: "desc",
};

initPositionMonitor({
  connectBtn: document.getElementById("connectBtn"),
  modal: document.getElementById("modal"),
  closeModal: document.getElementById("closeModal"),
  saveBtn: document.getElementById("saveKeys"),
  clearBtn: document.getElementById("clearKeys"),
});

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
    elements.refreshStatus.textContent = "Refreshing...";
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

    const positions = await loadPositions();
    renderPositions(positions);

    const timeStamp = new Date();
    elements.lastRefresh.textContent = timeStamp.toLocaleTimeString();
    elements.refreshStatus.textContent = `Auto-refresh: ${REFRESH_MS / 1000}s`;
  } catch (error) {
    elements.refreshStatus.textContent = "Refresh failed. Check console.";
    console.error(error);
  }
}

function matchPairs(orderlyRates, hyperRates) {
  const hyperMap = new Map();
  hyperRates.forEach((item) => {
    hyperMap.set(item.base, item);
  });

  return orderlyRates
    .map((orderly) => {
      const hyper = hyperMap.get(orderly.base);
      if (!hyper) return null;
      const orderlyAnnual = annualizeFrom8h(orderly.rate8h);
      const hyperAnnual = annualizeFrom8h(hyper.rate8h);
      const spread = orderlyAnnual - hyperAnnual;
      return {
        asset: orderly.base,
        orderlyAnnual,
        hyperAnnual,
        spread,
        apy: Math.abs(spread),
      };
    })
    .filter(Boolean);
}

function renderTable(rows) {
  elements.fundingBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.asset}</td>
      <td>${formatPercent(row.orderlyAnnual)}</td>
      <td>${formatPercent(row.hyperAnnual)}</td>
      <td class="${row.spread >= 0 ? "positive" : "negative"}">${formatPercent(row.spread)}</td>
      <td>${formatPercent(row.apy)}</td>
    `;
    tr.classList.add("refresh-animate");
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
      ? "Short Orderly / Long Hyperliquid"
      : "Short Hyperliquid / Long Orderly";

    const estOn10k = (10_000 * (row.apy / 100)).toFixed(0);

    card.innerHTML = `
      <div class="badge">${direction}</div>
      <h3>${row.asset}</h3>
      <p class="${row.spread >= 0 ? "positive" : "negative"}">Spread ${formatPercent(row.spread)}</p>
      <p>Orderly: ${formatPercent(row.orderlyAnnual)} | Hyperliquid: ${formatPercent(row.hyperAnnual)}</p>
      <p class="neutral">Est. APY on $10k: $${estOn10k}</p>
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
  const best = rows.reduce((acc, item) => (Math.abs(item.spread) > Math.abs(acc.spread) ? item : acc));
  elements.bestSpread.textContent = formatPercent(best.spread);
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
    return (a.spread - b.spread) * factor;
  });
  return sorted;
}

function renderPositions(data) {
  renderPositionList(elements.orderlyPositions, data.orderly);
  renderPositionList(elements.hyperliquidPositions, data.hyperliquid);

  if (!data.orderly && !data.hyperliquid) {
    elements.combinedPositions.textContent = "Awaiting account data.";
    elements.combinedPositions.classList.add("empty");
    return;
  }

  const all = [...(data.orderly || []), ...(data.hyperliquid || [])];
  const totalPnl = all.reduce((sum, item) => sum + (item.pnl || 0), 0);
  const netExposure = all.reduce((sum, item) => sum + (item.size || 0), 0);

  elements.combinedPositions.classList.remove("empty");
  elements.combinedPositions.innerHTML = `
    <div class="badge">Net Exposure: ${netExposure.toFixed(4)}</div>
    <div class="badge">Total PnL: ${formatCurrency(totalPnl)}</div>
    <div class="badge">Funding Earned: ${formatCurrency(0)}</div>
  `;
}

function renderPositionList(target, list) {
  if (!list || list.length === 0) {
    target.textContent = "No active positions.";
    target.classList.add("empty");
    return;
  }
  target.classList.remove("empty");
  target.innerHTML = "";
  list.forEach((item) => {
    const liqDistance = item.liq && item.mark ? ((item.mark - item.liq) / item.mark) * 100 : 0;
    const wrapper = document.createElement("div");
    wrapper.className = "badge";
    wrapper.innerHTML = `
      ${item.asset} | Size: ${item.size} | Entry: ${formatNumber(item.entry)} | Mark: ${formatNumber(item.mark)}
      | PnL: ${formatCurrency(item.pnl)} | Liq: ${formatNumber(item.liq)} | Liq Dist: ${liqDistance.toFixed(2)}%
    `;
    target.appendChild(wrapper);
  });
}

function annualizeFrom8h(rate) {
  return rate * 3 * 365 * 100;
}


function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(value || 0);
}

refreshAll();
setInterval(refreshAll, REFRESH_MS);
