const STORAGE_KEY = "defiyield-keys";

export function initPositionMonitor({ connectBtn, modal, closeModal, saveBtn, clearBtn }) {
  connectBtn.addEventListener("click", () => toggleModal(modal, true));
  closeModal.addEventListener("click", () => toggleModal(modal, false));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) toggleModal(modal, false);
  });

  saveBtn.addEventListener("click", () => {
    const payload = readModalFields();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    toggleModal(modal, false);
  });

  clearBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    toggleModal(modal, false);
  });

  hydrateModalFields();
}

export async function loadPositions() {
  const keys = getStoredKeys();
  if (!keys) {
    return { orderly: null, hyperliquid: null };
  }

  const [orderly, hyperliquid] = await Promise.all([
    fetchOrderlyPositions(keys).catch(() => null),
    fetchHyperliquidPositions(keys).catch(() => null),
  ]);

  return { orderly, hyperliquid };
}

function toggleModal(modal, show) {
  modal.classList.toggle("hidden", !show);
}

function readModalFields() {
  return {
    orderlyKey: document.getElementById("orderlyKey").value.trim(),
    orderlySecret: document.getElementById("orderlySecret").value.trim(),
    orderlyPassphrase: document.getElementById("orderlyPassphrase").value.trim(),
    hyperAddress: document.getElementById("hyperAddress").value.trim(),
  };
}

function hydrateModalFields() {
  const keys = getStoredKeys();
  if (!keys) return;
  document.getElementById("orderlyKey").value = keys.orderlyKey || "";
  document.getElementById("orderlySecret").value = keys.orderlySecret || "";
  document.getElementById("orderlyPassphrase").value = keys.orderlyPassphrase || "";
  document.getElementById("hyperAddress").value = keys.hyperAddress || "";
}

function getStoredKeys() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchOrderlyPositions(keys) {
  if (!keys.orderlyKey || !keys.orderlySecret) return null;
  const res = await fetch("https://api-evm.orderly.org/v1/positions", {
    headers: {
      "orderly-key": keys.orderlyKey,
      "orderly-secret": keys.orderlySecret,
      "orderly-passphrase": keys.orderlyPassphrase || "",
    },
  });
  if (!res.ok) throw new Error("Orderly positions request failed");
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : data;
  return list.map((item) => ({
    asset: normalizeAsset(item.symbol || item.instrument_id || item.market),
    size: Number(item.position_qty ?? item.size ?? 0),
    entry: Number(item.avg_entry_price ?? item.entry_price ?? 0),
    mark: Number(item.mark_price ?? item.markPrice ?? 0),
    pnl: Number(item.unrealized_pnl ?? item.unrealizedPnl ?? 0),
    liq: Number(item.liq_price ?? item.liquidation_price ?? 0),
  }));
}

async function fetchHyperliquidPositions(keys) {
  if (!keys.hyperAddress) return null;
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: keys.hyperAddress }),
  });
  if (!res.ok) throw new Error("Hyperliquid positions request failed");
  const data = await res.json();
  const positions = data?.assetPositions || [];
  return positions.map((pos) => ({
    asset: pos?.position?.coin || pos?.coin,
    size: Number(pos?.position?.szi ?? pos?.position?.size ?? 0),
    entry: Number(pos?.position?.entryPx ?? 0),
    mark: Number(pos?.position?.markPx ?? 0),
    pnl: Number(pos?.position?.unrealizedPnl ?? 0),
    liq: Number(pos?.position?.liquidationPx ?? 0),
  }));
}

function normalizeAsset(symbol = "") {
  if (!symbol) return "";
  if (symbol.includes("PERP_")) return symbol.split("_")[1] || symbol;
  return symbol.split("-")[0];
}
