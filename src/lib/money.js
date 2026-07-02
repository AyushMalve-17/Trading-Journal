export function toNumber(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtMoney(n) {
  const num = toNumber(n);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function fmtPct(n, digits = 2) {
  const num = toNumber(n);
  return `${num.toFixed(digits)}%`;
}

export function calcRiskToReward(entry, stopLoss, takeProfit) {
  const e = toNumber(entry);
  const sl = toNumber(stopLoss);
  const tp = toNumber(takeProfit);
  const risk = Math.abs(e - sl);
  const reward = Math.abs(tp - e);
  if (risk === 0) return 0;
  return reward / risk;
}

export function calcProfitLoss(params) {
  // Simple beginner-friendly approximation:
  // Use price distance ratio * riskPct * accountBalance.
  // If riskPct is already given, we can compute P/L directionally.
  const { side, entryPrice, exitPrice, stopLoss, takeProfit, riskPct, accountBalance } = params;
  const e = toNumber(entryPrice);
  const x = toNumber(exitPrice);
  const sl = toNumber(stopLoss);
  const tp = toNumber(takeProfit);
  const risk = Math.abs(e - sl);
  const reward = Math.abs(tp - e);
  const dist = Math.abs(x - e);
  if (risk === 0) return 0;

  const rr = reward === 0 ? 0 : reward / risk;
  const pnlFromPrice = dist / risk; // how many R
  const direction = side === 'Sell' ? -1 : 1;
  const signed = direction * (x - e) / (risk / (side === 'Sell' ? -1 : 1));

  // Convert to % using riskPct, then to account.
  const pct = riskPct / 100;
  const account = toNumber(accountBalance);
  // pnl in account currency based on R movement
  // If x==sl => approx -1R; if x==tp => +rr R
  // We'll use dist/risk and direction based on Buy/Sell.
  // Determine if trade moved in favorable direction.
  const favorable = (side === 'Buy' && x >= e) || (side === 'Sell' && x <= e);
  const sign = favorable ? 1 : -1;
  const pnl = sign * (dist / risk) * pct * account;
  // guard
  return Number.isFinite(pnl) ? pnl : 0;
}

