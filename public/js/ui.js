export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;          // only ever used with trusted, server-authored lesson HTML
    else if (k === 'value') el.value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export const mount = (el, ...kids) => { clear(el); el.append(...kids.flat(Infinity).filter(Boolean)); return el; };
// Native append()/replaceChildren() turn `false`/`undefined` into text and do not flatten arrays; these helpers do.
export const add = (el, ...kids) => { el.append(...kids.flat(Infinity).filter(Boolean)); return el; };

export function toast(msg, err = false) {
  const t = h('div', { class: 'toast' + (err ? ' err' : ''), role: err ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), err ? 6500 : 3500);
}
export const loading = (text = 'Yuklanmoqda…') => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), ' ', text,
  h('div', { class: 'skel' }, h('i'), h('i'), h('i')));

// Small celebration: coloured paper pieces fall from the top (skipped for reduced-motion users).
export function confetti(n = 70) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#6d5efc', '#ff7a59', '#12a05c', '#f5a524', '#e11d48', '#2563eb'];
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < n; i++) {
    const p = h('i', {}); const s = 6 + Math.random() * 8;
    Object.assign(p.style, { left: Math.random() * 100 + '%', width: s + 'px', height: s * (0.5 + Math.random()) + 'px', background: colors[i % colors.length], animationDuration: 1.8 + Math.random() * 1.6 + 's', animationDelay: Math.random() * .5 + 's', transform: `rotate(${Math.random() * 360}deg)` });
    p.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); box.append(p);
  }
  document.body.append(box); setTimeout(() => box.remove(), 4200);
}

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
export const MONTHS_UZ = MONTHS;
export function fmtDate(s, withWeekday = false) {
  const [y, m, d] = s.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${d} ${MONTHS[m - 1]} ${y} yil${withWeekday ? ', ' + wd : ''}`;
}
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} soat${m % 60 ? ' ' + (m % 60) + ' daqiqa' : ''}` : `${m} daqiqa`);
export const pct = (x) => Math.round((x ?? 0) * 100);
export const addDaysStr = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export const TYPE_ICON = { srs: '🔁', grammar: '📘', vocab: '🔤', reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️', custom: '📌' };
export const TONE_LABEL = { positive: "Rag'batlantiruvchi", neutral: 'Neytral', negative: "Qat'iy" };
export const toneBadge = (t) => h('span', { class: 'badge ' + (t === 'positive' ? 'ok' : t === 'negative' ? 'bad' : 'info') }, { positive: '😊 Pozitiv', neutral: '😐 Neytral', negative: '🧐 Qat\'iy' }[t] || t);

export function bar(frac, cls = '') { return h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, frac * 100)) + '%' } })); }

export function modal(title, content) {
  const back = h('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'grid', placeItems: 'center', padding: '14px' }, onclick: (e) => { if (e.target === back) back.remove(); } },
    h('div', { class: 'card', style: { maxWidth: '640px', width: '100%', maxHeight: '88vh', overflow: 'auto', margin: 0 }, role: 'dialog', 'aria-label': title },
      h('div', { class: 'row between' }, h('h2', {}, title), h('button', { class: 'btn ghost sm', onclick: () => back.remove(), 'aria-label': 'Yopish' }, '✕')), content));
  document.body.append(back);
  return back;
}

// Minimal SVG multi-line chart. series: [{name, color, points:[{x: label, y: number}]}]
export function lineChart(series, { height = 200, min = 0, max = 100, yLabels = [] } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 640, H = height, L = 36, R = 10, T = 10, B = 24;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('role', 'img'); svg.style.width = '100%'; svg.style.height = 'auto';
  const mk = (n, a, t) => { const e = document.createElementNS(NS, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; svg.append(e); return e; };
  const labels = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const X = (x) => L + (labels.length <= 1 ? (W - L - R) / 2 : (labels.indexOf(x) / (labels.length - 1)) * (W - L - R));
  const Y = (y) => T + (1 - (y - min) / (max - min)) * (H - T - B);
  for (const [v, t] of yLabels) { mk('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: 'currentColor', 'stroke-opacity': .12 }); mk('text', { x: 4, y: Y(v) + 4 }, t); }
  [0, labels.length - 1].forEach((i) => { if (labels[i]) mk('text', { x: X(labels[i]), y: H - 6, 'text-anchor': i ? 'end' : 'start' }, labels[i].slice(5)); });
  for (const s of series) {
    const pts = s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ');
    if (s.points.length > 1) mk('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 2.4, 'stroke-linejoin': 'round' });
    s.points.forEach((p) => mk('circle', { cx: X(p.x), cy: Y(p.y), r: 3.3, fill: s.color }));
  }
  return svg;
}
export const COLORS = { grammar: '#4f46e5', vocab: '#0ea5e9', reading: '#16a34a', listening: '#f59e0b', writing: '#db2777', speaking: '#9333ea', overall: '#111827' };
export const SKILL_NAME = { grammar: 'Grammatika', vocab: "Lug'at", reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };
export const CEFR_Y = [[15, 'A2'], [35, 'B1'], [55, 'B2'], [75, 'C1'], [92, 'C2']];

export function levelCard(title, lvl, extra) {
  return h('div', { class: 'card flat stat' }, h('span', {}, title), lvl ? h('div', { class: 'big-level' }, lvl.cefr) : h('b', {}, '—'), lvl && h('div', { class: 'muted' }, `IELTS ≈ ${lvl.ielts}`), extra);
}
export function skillBars(skills) {
  return h('div', { class: 'stack' }, skills.map((s) => h('div', {}, h('div', { class: 'row between' }, h('b', {}, s.name || SKILL_NAME[s.skill]), s.cefr ? h('span', {}, `${s.cefr} · IELTS ${s.ielts}`) : h('span', { class: 'muted' }, '—')), bar((s.ability ?? 0) / 100))));
}
