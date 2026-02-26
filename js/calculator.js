export function initCalculator({ pairSelect, calcBtn, capitalInput, feeInput, results }) {
  calcBtn.addEventListener("click", () => {
    const pair = pairSelect.value;
    if (!pair) return;
    const spread = Number(pairSelect.selectedOptions[0]?.dataset?.spread || 0);
    const capital = Number(capitalInput.value || 0);
    const feePercent = Number(feeInput.value || 0);
    const output = calculateEarnings(capital, spread, feePercent);
    results.innerHTML = renderResults(output);
  });
}

export function updateCalculatorPairs(pairSelect, pairs) {
  pairSelect.innerHTML = "";
  pairs.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.asset;
    option.textContent = `${item.asset} — ${formatPercent(item.spread)}`;
    option.dataset.spread = item.spread;
    pairSelect.appendChild(option);
  });
}

export function calculateEarnings(capital, spreadPercent, feePercent) {
  const annualRate = spreadPercent / 100;
  const grossAnnual = capital * annualRate;
  const grossMonthly = grossAnnual / 12;
  const grossWeekly = grossAnnual / 52;
  const grossDaily = grossAnnual / 365;

  const feeRate = feePercent / 100;
  const totalFees = capital * feeRate * 4;

  return {
    grossDaily,
    grossWeekly,
    grossMonthly,
    grossAnnual,
    totalFees,
    netAnnual: grossAnnual - totalFees,
  };
}

function renderResults(output) {
  return `
    <div class="badge">Daily: ${formatCurrency(output.grossDaily)}</div>
    <div class="badge">Weekly: ${formatCurrency(output.grossWeekly)}</div>
    <div class="badge">Monthly: ${formatCurrency(output.grossMonthly)}</div>
    <div class="badge">Yearly: ${formatCurrency(output.grossAnnual)}</div>
    <div class="badge">Fees (entry/exit): ${formatCurrency(output.totalFees)}</div>
    <div class="badge">Net Annual: ${formatCurrency(output.netAnnual)}</div>
  `;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}
