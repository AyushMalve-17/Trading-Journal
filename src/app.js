import { dataStore } from './lib/storage.js';
import { calcRiskToReward, calcProfitLoss, toNumber, fmtMoney } from './lib/money.js';
import { notifySuccess, notifyError, notifyWarn } from './lib/notify.js';

const state = { trades: [] };

let chartInstances = {
  winLoss: null,
  monthly: null,
  strategy: null,
  session: null,
  rrDist: null,
};

const els = {
  themeToggle: document.getElementById('themeToggle'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),

  // views
  dashboard: document.getElementById('view-dashboard'),
  add: document.getElementById('view-add'),
  history: document.getElementById('view-history'),
  stats: document.getElementById('view-stats'),
  data: document.getElementById('view-data'),

  navLinks: Array.from(document.querySelectorAll('.nav-link')),

  // dashboard
  mTotalTrades: document.getElementById('mTotalTrades'),
  mWinRate: document.getElementById('mWinRate'),
  mTotalPnL: document.getElementById('mTotalPnL'),
  mBalance: document.getElementById('mBalance'),
  mAvgRR: document.getElementById('mAvgRR'),
  mAvgRiskPct: document.getElementById('mAvgRiskPct'),
  recentTradesTbody: document.getElementById('recentTradesTbody'),

  // form
  tradeForm: document.getElementById('tradeForm'),
  resetFormBtn: document.getElementById('resetFormBtn'),
  submitTradeBtn: document.getElementById('submitTradeBtn'),

  // history
  searchBox: document.getElementById('searchBox'),
  filterFrom: document.getElementById('filterFrom'),
  filterTo: document.getElementById('filterTo'),
  filterStrategy: document.getElementById('filterStrategy'),
  filterResult: document.getElementById('filterResult'),
  filterPair: document.getElementById('filterPair'),
  sortOrder: document.getElementById('sortOrder'),
  clearFiltersBtn: document.getElementById('clearFiltersBtn'),
  historyTbody: document.getElementById('historyTbody'),

  // data view
  csvExportBtn: document.getElementById('csvExportBtn'),
  csvImportFile: document.getElementById('csvImportFile'),
  csvImportBtn: document.getElementById('csvImportBtn'),

  jsonBackupBtn: document.getElementById('jsonBackupBtn'),
  jsonRestoreFile: document.getElementById('jsonRestoreFile'),
  jsonRestoreBtn: document.getElementById('jsonRestoreBtn'),
};

const UI = {
  setView(viewName) {
    const map = {
      dashboard: els.dashboard,
      add: els.add,
      history: els.history,
      stats: els.stats,
      data: els.data,
    };
    Object.values(map).forEach((v) => v.classList.add('hidden'));
    map[viewName]?.classList.remove('hidden');

    for (const link of els.navLinks) {
      link.classList.toggle('active', link.dataset.view === viewName);
    }
  },
};

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getAccountFromState() {
  const stored = dataStore.load();
  return stored.account || { balance: 0, startingBalance: 0 };
}

function setAccountBalance(balance) {
  const current = dataStore.load();
  const next = { ...current, account: { ...(current.account || { startingBalance: 0 }), balance } };
  dataStore.save(next);
}

function loadAll() {
  const stored = dataStore.load();
  state.trades = Array.isArray(stored.trades) ? stored.trades : [];

  // normalize/rehydrate shape
  state.trades = state.trades.map((t) => ({
    id: t.id || uid(),
    date: t.date || '',
    pair: t.pair || '',
    side: t.side || 'Buy',
    session: t.session || 'Asian',
    strategy: t.strategy || 'Other',
    entryPrice: toNumber(t.entryPrice),
    stopLoss: toNumber(t.stopLoss),
    takeProfit: toNumber(t.takeProfit),
    exitPrice: toNumber(t.exitPrice),
    lotSize: toNumber(t.lotSize),
    riskPct: toNumber(t.riskPct),
    riskToReward: toNumber(t.riskToReward),
    profitLoss: toNumber(t.profitLoss),
    result: t.result || 'Loss',
    emotionsBefore: t.emotionsBefore || '',
    emotionsAfter: t.emotionsAfter || '',
    mistakes: t.mistakes || '',
    lessons: t.lessons || '',
    notes: t.notes || '',
    screenshotBefore: t.screenshotBefore || null,
    screenshotAfter: t.screenshotAfter || null,
    createdAt: t.createdAt || Date.now(),
    updatedAt: t.updatedAt || Date.now(),
  }));

  dataStore.save({ trades: state.trades, account: stored.account });
}

function saveAll() {
  const stored = dataStore.load();
  dataStore.save({ trades: state.trades, account: stored.account });
}

function ensureStrategyOptions() {
  const strategiesFromTrades = Array.from(new Set(state.trades.map((t) => t.strategy))).filter(Boolean);
  const defaults = ['SMC', 'Price Action', 'Scalping', 'Breakout', 'Swing', 'Other'];
  const all = Array.from(new Set([...defaults, ...strategiesFromTrades])).sort();

  els.filterStrategy.innerHTML = '<option value="">All</option>';
  for (const s of all) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    els.filterStrategy.appendChild(opt);
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function badgeForResult(result) {
  if (result === 'Win') return `<span class="badge good">Win</span>`;
  if (result === 'Loss') return `<span class="badge bad">Loss</span>`;
  if (result === 'Breakeven') return `<span class="badge warn">Breakeven</span>`;
  return `<span class="badge">${escapeHtml(result || '')}</span>`;
}

function computeDashboard() {
  const trades = state.trades;
  const totalTrades = trades.length;

  const winCount = trades.filter((t) => t.result === 'Win').length;
  const winRate = totalTrades === 0 ? 0 : (winCount / totalTrades) * 100;
  const totalPnL = trades.reduce((sum, t) => sum + toNumber(t.profitLoss), 0);

  const account = getAccountFromState();
  const balance = toNumber(account.balance);

  const avgRR = totalTrades === 0 ? 0 : trades.reduce((s, t) => s + toNumber(t.riskToReward), 0) / totalTrades;
  const avgRiskPct = totalTrades === 0 ? 0 : trades.reduce((s, t) => s + toNumber(t.riskPct), 0) / totalTrades;

  els.mTotalTrades.textContent = String(totalTrades);
  els.mWinRate.textContent = `${winRate.toFixed(2)}%`;
  els.mTotalPnL.textContent = `${totalPnL >= 0 ? '+' : ''}${fmtMoney(totalPnL)}`;
  els.mBalance.textContent = fmtMoney(balance);
  els.mAvgRR.textContent = avgRR.toFixed(2);
  els.mAvgRiskPct.textContent = `${avgRiskPct.toFixed(2)}%`;

  const recent = [...trades].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 8);

  els.recentTradesTbody.innerHTML = '';
  if (recent.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="8" class="muted">No trades yet. Add your first trade.</td>`;
    els.recentTradesTbody.appendChild(tr);
    return;
  }

  for (const t of recent) {
    const rr = toNumber(t.riskToReward);
    const pnl = toNumber(t.profitLoss);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.date)}</td>
      <td>${escapeHtml(t.pair)}</td>
      <td>${escapeHtml(t.side)}</td>
      <td>${escapeHtml(t.session)}</td>
      <td>${escapeHtml(t.strategy)}</td>
      <td>${badgeForResult(t.result)}</td>
      <td>${rr ? rr.toFixed(2) : '0.00'}</td>
      <td style="font-weight:800; color:${pnl >= 0 ? 'var(--good)' : 'var(--bad)'}">${pnl >= 0 ? '+' : ''}${fmtMoney(pnl)}</td>
    `;
    els.recentTradesTbody.appendChild(tr);
  }
}

function renderHistory() {
  const trades = state.trades;
  const q = (els.searchBox.value || '').toLowerCase().trim();
  const from = els.filterFrom.value ? new Date(els.filterFrom.value) : null;
  const to = els.filterTo.value ? new Date(els.filterTo.value) : null;
  const strategy = els.filterStrategy.value;
  const result = els.filterResult.value;
  const pair = (els.filterPair.value || '').toLowerCase().trim();
  const sortOrder = els.sortOrder.value;

  const filtered = trades.filter((t) => {
    const hitQ = !q || [
      t.pair,
      t.strategy,
      t.notes,
      t.emotionsBefore,
      t.emotionsAfter,
      t.mistakes,
      t.lessons,
      t.session,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);

    const dt = t.date ? new Date(t.date + 'T00:00:00') : null;
    const hitFrom = !from || (dt && dt >= from);
    const hitTo = !to || (dt && dt <= to);
    const hitStrategy = !strategy || t.strategy === strategy;
    const hitResult = !result || t.result === result;
    const hitPair = !pair || (t.pair || '').toLowerCase().includes(pair);

    return hitQ && hitFrom && hitTo && hitStrategy && hitResult && hitPair;
  });

  filtered.sort((a, b) => {
    const da = a.date || '';
    const db = b.date || '';
    if (sortOrder === 'oldest') return da.localeCompare(db);
    return db.localeCompare(da);
  });

  els.historyTbody.innerHTML = '';
  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="9" class="muted">No trades match your filters.</td>`;
    els.historyTbody.appendChild(tr);
    return;
  }

  for (const t of filtered) {
    const pnl = toNumber(t.profitLoss);
    const rr = toNumber(t.riskToReward);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.date)}</td>
      <td>${escapeHtml(t.pair)}</td>
      <td>${escapeHtml(t.side)}</td>
      <td>${escapeHtml(t.session)}</td>
      <td>${escapeHtml(t.strategy)}</td>
      <td>${badgeForResult(t.result)}</td>
      <td>${rr ? rr.toFixed(2) : '0.00'}</td>
      <td style="font-weight:800; color:${pnl >= 0 ? 'var(--good)' : 'var(--bad)'}">${pnl >= 0 ? '+' : ''}${fmtMoney(pnl)}</td>
      <td>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn btn-ghost" type="button" data-action="edit" data-id="${escapeHtml(t.id)}">Edit</button>
          <button class="btn btn-ghost" type="button" data-action="delete" data-id="${escapeHtml(t.id)}">Delete</button>
        </div>
      </td>
    `;
    els.historyTbody.appendChild(tr);
  }
}

function syncFormAutoCalcs() {
  const form = els.tradeForm;

  const entry = form.entryPrice.value;
  const stopLoss = form.stopLoss.value;
  const takeProfit = form.takeProfit.value;
  const riskToReward = calcRiskToReward(entry, stopLoss, takeProfit);
  form.riskToReward.value = riskToReward ? riskToReward.toFixed(2) : '0.00';

  const side = form.side.value;
  const exitPrice = form.exitPrice.value;
  const riskPct = toNumber(form.riskPct.value);
  const account = getAccountFromState();
  const accountBalance = toNumber(account.balance);

  const pnl = calcProfitLoss({
    side,
    entryPrice: form.entryPrice.value,
    exitPrice,
    stopLoss,
    takeProfit,
    riskPct,
    accountBalance,
  });
  form.profitLoss.value = pnl ? pnl.toFixed(2) : '0.00';
}

function setFormMode(mode, trade = null) {
  const form = els.tradeForm;
  form.reset();
  form.querySelector('input[name="id"]').value = '';

  form.riskToReward.value = '0.00';
  form.profitLoss.value = '0.00';

  if (mode === 'edit' && trade) {
    form.id.value = trade.id;
    form.date.value = trade.date;
    form.pair.value = trade.pair;
    form.side.value = trade.side;
    form.session.value = trade.session;
    form.strategy.value = trade.strategy;
    form.entryPrice.value = trade.entryPrice;
    form.stopLoss.value = trade.stopLoss;
    form.takeProfit.value = trade.takeProfit;
    form.exitPrice.value = trade.exitPrice;
    form.lotSize.value = trade.lotSize;
    form.riskPct.value = trade.riskPct;
    form.result.value = trade.result;
    form.emotionsBefore.value = trade.emotionsBefore;
    form.emotionsAfter.value = trade.emotionsAfter;
    form.mistakes.value = trade.mistakes;
    form.lessons.value = trade.lessons;
    form.notes.value = trade.notes;

    form.riskToReward.value = trade.riskToReward?.toFixed ? trade.riskToReward.toFixed(2) : (trade.riskToReward || 0);
    form.profitLoss.value = trade.profitLoss?.toFixed ? trade.profitLoss.toFixed(2) : (trade.profitLoss || 0);

    form.screenshotBefore._existing = trade.screenshotBefore || null;
    form.screenshotAfter._existing = trade.screenshotAfter || null;

    els.submitTradeBtn.textContent = 'Save Changes';
  } else {
    els.submitTradeBtn.textContent = 'Add Trade';
    form.screenshotBefore._existing = null;
    form.screenshotAfter._existing = null;
  }

  syncFormAutoCalcs();
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function attachFilePreview(inputEl) {
  const previewHost = document.querySelector(`.file-preview[data-preview-for="${inputEl.name}"]`);
  if (!previewHost) return;

  inputEl.addEventListener('change', async () => {
    previewHost.innerHTML = '';
    const file = inputEl.files && inputEl.files[0];
    if (!file) {
      inputEl._dataUrl = null;
      return;
    }

    try {
      const url = await readFileAsDataURL(file);
      inputEl._dataUrl = url;
      const img = document.createElement('img');
      img.src = url;
      previewHost.appendChild(img);
    } catch {
      notifyError('Upload failed', 'Could not read the image file.');
    }
  });
}

function currentFormTradeDraft() {
  const form = els.tradeForm;
  return {
    id: form.id?.value || uid(),
    date: form.date.value,
    pair: form.pair.value.trim(),
    side: form.side.value,
    session: form.session.value,
    strategy: form.strategy.value,
    entryPrice: toNumber(form.entryPrice.value),
    stopLoss: toNumber(form.stopLoss.value),
    takeProfit: toNumber(form.takeProfit.value),
    exitPrice: toNumber(form.exitPrice.value),
    lotSize: toNumber(form.lotSize.value),
    riskPct: toNumber(form.riskPct.value),
    riskToReward: toNumber(form.riskToReward.value),
    profitLoss: toNumber(form.profitLoss.value),
    result: form.result.value,
    emotionsBefore: form.emotionsBefore.value || '',
    emotionsAfter: form.emotionsAfter.value || '',
    mistakes: form.mistakes.value || '',
    lessons: form.lessons.value || '',
    notes: form.notes.value || '',
    screenshotBefore: form.screenshotBefore._dataUrl || form.screenshotBefore._existing || null,
    screenshotAfter: form.screenshotAfter._dataUrl || form.screenshotAfter._existing || null,
    updatedAt: Date.now(),
  };
}

function upsertTrade(draft) {
  const idx = state.trades.findIndex((t) => t.id === draft.id);
  if (idx === -1) {
    draft.createdAt = Date.now();
    state.trades.push(draft);
  } else {
    draft.createdAt = state.trades[idx].createdAt;
    state.trades[idx] = draft;
  }
}

function updateAccountFromPnL(pnlDelta) {
  const account = getAccountFromState();
  const balance = toNumber(account.balance);
  setAccountBalance(balance + toNumber(pnlDelta));
}

function wireForm() {
  const form = els.tradeForm;

  for (const name of ['entryPrice', 'stopLoss', 'takeProfit', 'exitPrice', 'riskPct', 'side']) {
    form[name].addEventListener('input', () => syncFormAutoCalcs());
  }

  attachFilePreview(form.screenshotBefore);
  attachFilePreview(form.screenshotAfter);

  // autosave draft fields (excluding screenshots)
  const autosaveKey = 'tradeDraft.autosave.v1';

  const persistDraft = () => {
    const payload = {};
    for (const input of Array.from(form.elements)) {
      if (!('name' in input)) continue;
      if (input.type === 'file') continue;
      if (input.name) payload[input.name] = input.value;
    }
    localStorage.setItem(autosaveKey, JSON.stringify(payload));
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(autosaveKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // don't overwrite if editing
      if (form.id?.value) return;
      for (const [k, v] of Object.entries(parsed)) {
        if (form[k] && typeof v !== 'undefined') form[k].value = v;
      }
      syncFormAutoCalcs();
    } catch {
      // ignore
    }
  };

  for (const input of Array.from(form.elements)) {
    if (!input.name || input.type === 'file') continue;
    input.addEventListener('input', persistDraft);
  }
  restoreDraft();

  els.resetFormBtn.addEventListener('click', () => {
    localStorage.removeItem(autosaveKey);
    setFormMode('add');
    notifyWarn('Form reset', 'Cleared the current draft fields.');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const draft = currentFormTradeDraft();

      if (!draft.date || !draft.pair) {
        notifyError('Missing fields', 'Please provide date and trading pair.');
        return;
      }
      if (!draft.entryPrice || !draft.stopLoss || !draft.takeProfit || !draft.exitPrice) {
        notifyError('Invalid prices', 'Entry/Stop Loss/Take Profit/Exit Price must be numbers.');
        return;
      }
      if (!draft.riskPct) {
        notifyWarn('Risk % is zero', 'Set Risk % for meaningful P/L calculation.');
      }

      const existing = state.trades.find((t) => t.id === draft.id);
      const oldPnl = existing ? toNumber(existing.profitLoss) : 0;
      const newPnl = toNumber(draft.profitLoss);

      upsertTrade(draft);

      const delta = newPnl - oldPnl;
      updateAccountFromPnL(delta);

      saveAll();
      ensureStrategyOptions();
      computeDashboard();
      renderHistory();
      renderCharts();

      notifySuccess('Trade saved', existing ? 'Changes updated successfully.' : 'Trade added to your journal.');

      localStorage.removeItem(autosaveKey);
      setFormMode('add');
      UI.setView('dashboard');
    } catch (err) {
      notifyError('Save failed', String(err?.message || err));
    }
  });
}

function bindHistoryActions() {
  els.historyTbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    const trade = state.trades.find((t) => t.id === id);
    if (!trade) return;

    if (action === 'edit') {
      setFormMode('edit', trade);
      UI.setView('add');
      notifySuccess('Edit mode', 'You can update the trade details now.');
    }

    if (action === 'delete') {
      const ok = confirm('Delete this trade? This cannot be undone.');
      if (!ok) return;

      const pnl = toNumber(trade.profitLoss);
      const account = getAccountFromState();
      setAccountBalance(toNumber(account.balance) - pnl);

      state.trades = state.trades.filter((t) => t.id !== id);
      saveAll();
      ensureStrategyOptions();
      computeDashboard();
      renderHistory();
      renderCharts();

      notifyWarn('Trade deleted', 'The trade has been removed from your journal.');
    }
  });
}

function bindFilters() {
  const rerender = () => renderHistory();

  els.searchBox.addEventListener('input', rerender);
  els.filterFrom.addEventListener('change', rerender);
  els.filterTo.addEventListener('change', rerender);
  els.filterStrategy.addEventListener('change', rerender);
  els.filterResult.addEventListener('change', rerender);
  els.filterPair.addEventListener('input', rerender);
  els.sortOrder.addEventListener('change', rerender);

  els.clearFiltersBtn.addEventListener('click', () => {
    els.searchBox.value = '';
    els.filterFrom.value = '';
    els.filterTo.value = '';
    els.filterStrategy.value = '';
    els.filterResult.value = '';
    els.filterPair.value = '';
    els.sortOrder.value = 'newest';
    renderHistory();
  });
}

function sumBy(arr, keyFn, valFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    const prev = m.get(k) || 0;
    m.set(k, prev + valFn(x));
  }
  return m;
}

function destroyChart(ref) {
  if (ref) ref.destroy();
}

function renderCharts() {
  const trades = state.trades;

  const winLoss = {
    Win: trades.filter((t) => t.result === 'Win').length,
    Loss: trades.filter((t) => t.result === 'Loss').length,
    Breakeven: trades.filter((t) => t.result === 'Breakeven').length,
  };

  // Monthly P/L
  const monthlyMap = new Map();
  for (const t of trades) {
    if (!t.date) continue;
    const d = new Date(t.date + 'T00:00:00');
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + toNumber(t.profitLoss));
  }
  const monthlyLabels = Array.from(monthlyMap.keys()).sort();
  const monthlyValues = monthlyLabels.map((k) => monthlyMap.get(k));

  const stratPL = sumBy(trades, (t) => t.strategy || 'Other', (t) => toNumber(t.profitLoss));
  const stratLabels = Array.from(stratPL.keys());
  const stratValues = stratLabels.map((k) => stratPL.get(k));

  const sessionPL = sumBy(trades, (t) => t.session || 'Asian', (t) => toNumber(t.profitLoss));
  const sessionLabels = Array.from(sessionPL.keys());
  const sessionValues = sessionLabels.map((k) => sessionPL.get(k));

  const rrBuckets = new Map();
  for (const t of trades) {
    const rr = toNumber(t.riskToReward);
    if (!Number.isFinite(rr) || rr < 0) continue;
    const lower = Math.floor(rr);
    const label = rr >= 5 ? '5+' : `${lower}-${lower + 1}`;
    rrBuckets.set(label, (rrBuckets.get(label) || 0) + 1);
  }
  const rrLabels = Array.from(rrBuckets.keys()).sort();
  const rrValues = rrLabels.map((k) => rrBuckets.get(k));

  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const gridColor = theme === 'light' ? 'rgba(13,23,48,.18)' : 'rgba(231,238,252,.12)';
  const textColor = theme === 'light' ? '#0d1730' : '#e7eefc';

  destroyChart(chartInstances.winLoss);
  destroyChart(chartInstances.monthly);
  destroyChart(chartInstances.strategy);
  destroyChart(chartInstances.session);
  destroyChart(chartInstances.rrDist);

  const common = {
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  };

  chartInstances.winLoss = new Chart(document.getElementById('chartWinLoss'), {
    type: 'bar',
    data: {
      labels: ['Win', 'Loss', 'Breakeven'],
      datasets: [{
        label: 'Trades',
        data: [winLoss.Win, winLoss.Loss, winLoss.Breakeven],
        backgroundColor: ['rgba(55,214,122,.55)','rgba(255,77,109,.55)','rgba(255,204,0,.4)'],
        borderColor: ['rgba(55,214,122,1)','rgba(255,77,109,1)','rgba(255,204,0,1)'],
        borderWidth: 1,
      }],
    },
    options: common,
  });

  chartInstances.monthly = new Chart(document.getElementById('chartMonthly'), {
    type: 'line',
    data: {
      labels: monthlyLabels.length ? monthlyLabels : ['—'],
      datasets: [{
        label: 'Monthly Profit/Loss',
        data: monthlyValues.length ? monthlyValues : [0],
        borderColor: 'rgba(47,123,255,1)',
        backgroundColor: 'rgba(47,123,255,.15)',
        tension: 0.35,
        fill: true,
      }],
    },
    options: common,
  });

  chartInstances.strategy = new Chart(document.getElementById('chartStrategy'), {
    type: 'bar',
    data: {
      labels: stratLabels.length ? stratLabels : ['—'],
      datasets: [{
        label: 'Strategy P/L',
        data: stratValues.length ? stratValues : [0],
        backgroundColor: 'rgba(57,209,255,.35)',
        borderColor: 'rgba(57,209,255,1)',
        borderWidth: 1,
      }],
    },
    options: common,
  });

  chartInstances.session = new Chart(document.getElementById('chartSession'), {
    type: 'bar',
    data: {
      labels: sessionLabels.length ? sessionLabels : ['—'],
      datasets: [{
        label: 'Session P/L',
        data: sessionValues.length ? sessionValues : [0],
        backgroundColor: 'rgba(47,123,255,.28)',
        borderColor: 'rgba(47,123,255,1)',
        borderWidth: 1,
      }],
    },
    options: common,
  });

  chartInstances.rrDist = new Chart(document.getElementById('chartRiskDist'), {
    type: 'bar',
    data: {
      labels: rrLabels.length ? rrLabels : ['—'],
      datasets: [{
        label: 'RR Buckets',
        data: rrValues.length ? rrValues : [0],
        backgroundColor: 'rgba(255,204,0,.22)',
        borderColor: 'rgba(255,204,0,1)',
        borderWidth: 1,
      }],
    },
    options: common,
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(trades) {
  const headers = [
    'date','pair','side','session','strategy',
    'entryPrice','stopLoss','takeProfit','exitPrice','lotSize','riskPct',
    'riskToReward','profitLoss','result',
    'emotionsBefore','emotionsAfter','mistakes','lessons','notes',
  ];

  const esc = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
    return s;
  };

  const lines = [headers.join(',')];
  for (const t of trades) {
    lines.push(headers.map((h) => esc(t[h])).join(','));
  }
  return lines.join('\n');
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((x) => x.trim());
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = parts[idx] ?? ''; });
    out.push(obj);
  }
  return out;
}

function splitCSVLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { res.push(cur); cur = ''; continue; }
    cur += ch;
  }
  res.push(cur);
  return res;
}

function wireDataView() {
  els.csvExportBtn.addEventListener('click', () => {
    try {
      const csv = toCSV(state.trades);
      downloadText(`trading-journal_${new Date().toISOString().slice(0,10)}.csv`, csv);
      notifySuccess('CSV exported', 'Downloaded your trades as CSV.');
    } catch (e) {
      notifyError('CSV export failed', String(e?.message || e));
    }
  });

  els.csvImportBtn.addEventListener('click', async () => {
    try {
      const file = els.csvImportFile.files && els.csvImportFile.files[0];
      if (!file) {
        notifyWarn('Select a file', 'Choose a CSV file first.');
        return;
      }

      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        notifyWarn('No rows found', 'The CSV appears empty.');
        return;
      }

      for (const r of rows) {
        const draft = {
          id: uid(),
          date: r.date,
          pair: r.pair,
          side: r.side,
          session: r.session,
          strategy: r.strategy,
          entryPrice: toNumber(r.entryPrice),
          stopLoss: toNumber(r.stopLoss),
          takeProfit: toNumber(r.takeProfit),
          exitPrice: toNumber(r.exitPrice),
          lotSize: toNumber(r.lotSize),
          riskPct: toNumber(r.riskPct),
          riskToReward: calcRiskToReward(r.entryPrice, r.stopLoss, r.takeProfit),
          profitLoss: toNumber(r.profitLoss),
          result: r.result,
          emotionsBefore: r.emotionsBefore,
          emotionsAfter: r.emotionsAfter,
          mistakes: r.mistakes,
          lessons: r.lessons,
          notes: r.notes,
          screenshotBefore: null,
          screenshotAfter: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        state.trades.push(draft);
      }

      saveAll();
      ensureStrategyOptions();
      computeDashboard();
      renderHistory();
      renderCharts();

      notifySuccess('CSV imported', `Imported ${rows.length} trade(s). Screenshots not included.`);
    } catch (e) {
      notifyError('CSV import failed', String(e?.message || e));
    }
  });

  els.jsonBackupBtn.addEventListener('click', () => {
    try {
      const text = dataStore.exportJSON();
      downloadText(`trading-journal_backup_${new Date().toISOString().slice(0,10)}.json`, text);
      notifySuccess('Backup created', 'Downloaded JSON backup.');
    } catch (e) {
      notifyError('Backup failed', String(e?.message || e));
    }
  });

  els.jsonRestoreBtn.addEventListener('click', async () => {
    try {
      const file = els.jsonRestoreFile.files && els.jsonRestoreFile.files[0];
      if (!file) {
        notifyWarn('Select a file', 'Choose a JSON backup file first.');
        return;
      }
      const text = await file.text();
      const imported = JSON.parse(text);

      const next = {
        trades: Array.isArray(imported.trades) ? imported.trades : [],
        account: imported.account || { balance: 0, startingBalance: 0 },
      };

      state.trades = next.trades;
      dataStore.save(next);

      ensureStrategyOptions();
      computeDashboard();
      renderHistory();
      renderCharts();
      notifyWarn('Journal restored', 'Your journal data was replaced with the backup content.');
    } catch (e) {
      notifyError('Restore failed', String(e?.message || e));
    }
  });
}

function initTheme() {
  const saved = localStorage.getItem('tj.theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('tj.theme', next);
  renderCharts();
}

async function exportAsPDF() {
  try {
    const { jsPDF } = window.jspdf;
    notifyWarn('Preparing PDF...', 'Rendering may take a few seconds.');

    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const now = new Date();
    const exportDate = now.toLocaleString();

    // Title page
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Trading Journal', pageWidth / 2, 80, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Export date: ${exportDate}`, pageWidth / 2, 105, { align: 'center' });
    doc.text('Beginner-friendly journal with analytics', pageWidth / 2, 125, { align: 'center' });

    // Account summary
    const account = getAccountFromState();
    const trades = state.trades;
    const totalPnL = trades.reduce((s, t) => s + toNumber(t.profitLoss), 0);
    const winRate = trades.length ? (trades.filter((t) => t.result === 'Win').length / trades.length) * 100 : 0;
    const avgRR = trades.length ? trades.reduce((s, t) => s + toNumber(t.riskToReward), 0) / trades.length : 0;
    const avgRiskPct = trades.length ? trades.reduce((s, t) => s + toNumber(t.riskPct), 0) / trades.length : 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Account Summary', 40, 170);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Current Account Balance: ${fmtMoney(account.balance)}`, 40, 190);
    doc.text(`Total Trades: ${trades.length}`, 40, 210);
    doc.text(`Win Rate: ${winRate.toFixed(2)}%`, 40, 230);
    doc.text(`Overall Profit/Loss: ${totalPnL >= 0 ? '+' : ''}${fmtMoney(totalPnL)}`, 40, 250);
    doc.text(`Average Risk-to-Reward: ${avgRR.toFixed(2)}`, 40, 270);
    doc.text(`Average Risk %: ${avgRiskPct.toFixed(2)}%`, 40, 290);

    // Charts page
    doc.addPage();
    let y = 40;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Performance Charts', 40, y);
    y += 18;

    const chartIds = ['chartWinLoss','chartMonthly','chartStrategy','chartSession','chartRiskDist'];
    for (const id of chartIds) {
      const canvas = document.getElementById(id);
      if (!canvas) continue;

      const parent = canvas.parentElement || canvas;
      const imgCanvas = await window.html2canvas(parent, { scale: 2 });
      const png = imgCanvas.toDataURL('image/png');

      const imgWidth = pageWidth - 80;
      const aspect = imgCanvas.height / imgCanvas.width;
      const imgHeight = imgWidth * aspect;

      if (y + imgHeight > pageHeight - 60) {
        doc.addPage();
        y = 40;
      }

      doc.addImage(png, 'PNG', 40, y, imgWidth, imgHeight);
      y += imgHeight + 14;
    }

    // Trade history table page
    doc.addPage();
    y = 40;
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);
    doc.text('Trade History', 40, y);
    y += 18;

    doc.setFont('helvetica','normal');
    doc.setFontSize(10);

    const rows = [...trades].sort((a,b)=> (b.date||'').localeCompare(a.date||''));

    // Simple table-like columns
    const headers = ['Date','Pair','Type','Session','Strategy','Result','R:R','P/L','Notes'];
    const colWidths = [60,90,45,60,85,70,55,60,110];
    const startX = 40;

    let x = startX;
    doc.setFont('helvetica','bold');
    for (let i=0;i<headers.length;i++) {
      doc.text(headers[i], x, y);
      x += colWidths[i];
    }
    y += 12;
    doc.setDrawColor(120,160,255);
    doc.line(startX, y-4, pageWidth-40, y-4);
    doc.setDrawColor(0,0,0);
    doc.setFont('helvetica','normal');

    const lineHeight = 12;
    const noteMax = 45;

    for (const t of rows) {
      if (y > pageHeight - 110) {
        doc.addPage();
        y = 40;
      }

      const notes = String(t.notes || '').replaceAll('\n',' ');
      const shortNotes = notes.length > noteMax ? notes.slice(0, noteMax-1) + '…' : notes;
      const rr = toNumber(t.riskToReward);
      const pnl = toNumber(t.profitLoss);
      const pnlStr = (pnl >= 0 ? '+' : '') + fmtMoney(pnl);

      const cells = [t.date, t.pair, t.side, t.session, t.strategy, t.result, rr ? rr.toFixed(2) : '0.00', pnlStr, shortNotes];
      x = startX;
      for (let i=0;i<cells.length;i++) {
        doc.text(String(cells[i] ?? ''), x, y);
        x += colWidths[i];
      }
      y += lineHeight;

      // Individual trade screenshots (optional; add only if available)
      const before = t.screenshotBefore;
      const after = t.screenshotAfter;
      if ((before || after) && y < pageHeight - 60) {
        const boxW = (pageWidth - 120) / 2;
        const boxY = y;

        if (before) {
          doc.setFontSize(9);
          doc.text('Before', startX + 2, boxY - 8);
          doc.addImage(before, 'JPEG', startX, boxY, boxW, boxW * 0.6);
        }
        if (after) {
          doc.setFontSize(9);
          doc.text('After', startX + boxW + 22, boxY - 8);
          doc.addImage(after, 'JPEG', startX + boxW + 20, boxY, boxW, boxW * 0.6);
        }
        y += boxW * 0.6 + 14;
        doc.setFontSize(10);
      }
    }

    // Footer with page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i=1;i<=pageCount;i++) {
      doc.setPage(i);
      const footerY = pageHeight - 24;
      doc.setFontSize(9);
      doc.setFont('helvetica','normal');
      doc.setTextColor(110);
      doc.text(`Export date: ${exportDate}`, 40, footerY);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 90, footerY);
      doc.setTextColor(0);
    }

    doc.save(`trading-journal_${new Date().toISOString().slice(0,10)}.pdf`);
    notifySuccess('PDF exported', 'Your PDF has been downloaded.');
  } catch (e) {
    notifyError('PDF export failed', String(e?.message || e));
  }
}

function wirePDF() {
  els.exportPdfBtn.addEventListener('click', exportAsPDF);
}

function wireThemeToggle() {
  initTheme();
  els.themeToggle.addEventListener('click', toggleTheme);
}

function wireNavigation() {
  for (const link of els.navLinks) {
    link.addEventListener('click', () => {
      UI.setView(link.dataset.view);
      if (link.dataset.view === 'stats') renderCharts();
      if (link.dataset.view === 'history') renderHistory();
    });
  }
}

function wireMisc() {
  // nothing else for now
}

async function main() {
  loadAll();
  ensureStrategyOptions();

  computeDashboard();
  renderHistory();
  renderCharts();

  wireThemeToggle();
  wireNavigation();
  wirePDF();
  wireForm();
  bindHistoryActions();
  bindFilters();
  wireDataView();

  setFormMode('add');
  UI.setView('dashboard');
  wireMisc();
}

main();

