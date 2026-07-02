const host = () => document.getElementById('toastHost');

function makeToast(type, title, body) {
  const el = document.createElement('div');
  el.className = `toast ${type || ''}`.trim();
  el.innerHTML = `
    <div class="t-title">${escapeHtml(title)}</div>
    <div class="t-body">${escapeHtml(body || '')}</div>
  `;
  return el;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

export function notifySuccess(title, body) {
  const h = host();
  if (!h) return;
  const t = makeToast('good', title, body);
  h.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

export function notifyError(title, body) {
  const h = host();
  if (!h) return;
  const t = makeToast('bad', title, body);
  h.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export function notifyWarn(title, body) {
  const h = host();
  if (!h) return;
  const t = makeToast('warn', title, body);
  h.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

