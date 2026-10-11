import { api, localDate } from '../api.js';
import { h, fmtDate, fmtMin, bar, MONTHS_UZ, addDaysStr, loading, mount, toast } from '../ui.js';
import { taskRow } from './home.js';
import { go } from '../state.js';

export async function trajectoryView({ args }) {
  const plan = await api.get('/api/plan');
  const today = plan.today;
  if (!plan.plan) return h('div', { class: 'card' }, h('p', {}, 'Traektoriya hali yaratilmagan.'), h('a', { class: 'btn', href: '#/goal' }, 'Maqsad belgilash'));
  let sel = args[0] || today;
  let ym = sel.slice(0, 7);
  const calBox = h('div', {}), dayBox = h('div', {});

  async function drawCal() {
    const [y, m] = ym.split('-').map(Number);
    const first = `${ym}-01`;
    const last = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const cal = await api.get(`/api/plan/calendar?from=${first}&to=${last}`);
    const by = Object.fromEntries(cal.days.map((d) => [d.date, d]));
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const cells = [...['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map((d) => h('div', { class: 'dow' }, d)), ...Array(lead).fill(0).map(() => h('div', { class: 'day empty' }))];
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const ds = `${ym}-${String(d).padStart(2, '0')}`, info = by[ds];
      const cls = ['day']; if (ds === sel) cls.push('sel'); if (ds === today) cls.push('today');
      if (info) { if (info.done === info.n) cls.push('full'); else if (ds < today) cls.push('missed'); else if (info.done) cls.push('part'); }
      cells.push(h('button', { class: cls.join(' '), onclick: () => { sel = ds; drawCal(); drawDay(); history.replaceState(null, '', '#/trajectory/' + ds); }, 'aria-label': fmtDate(ds), disabled: !info && ds < plan.plan.start }, String(d), info?.extra ? h('span', { class: 'dot', title: "Qo'shimcha topshiriq" }) : null,
        info && h('div', { class: 'muted', style: { fontSize: '.7rem' } }, `${info.done}/${info.n}`)));
    }
    mount(calBox, h('div', { class: 'row between' }, h('button', { class: 'btn secondary sm', onclick: () => { ym = shift(ym, -1); drawCal(); } }, '←'), h('b', {}, `${MONTHS_UZ[m - 1]} ${y}`), h('button', { class: 'btn secondary sm', onclick: () => { ym = shift(ym, 1); drawCal(); } }, '→')),
      h('div', { class: 'calendar', style: { marginTop: '8px' } }, cells),
      h('div', { class: 'legend', style: { marginTop: '8px' } }, [['var(--ok-soft)', 'bajarilgan'], ['var(--warn-soft)', 'qisman'], ['var(--bad-soft)', "o'tkazib yuborilgan"]].map(([c, t]) => h('span', {}, h('i', { style: { background: c, border: '1px solid var(--line)' } }), t)), h('span', {}, h('i', { style: { background: 'var(--brand)' } }), "o'qituvchi topshirig'i")));
  }
  async function drawDay() {
    mount(dayBox, loading());
    const d = await api.get('/api/plan/day?date=' + sel);
    mount(dayBox, h('div', { class: 'row between' }, h('div', {}, h('h2', { style: { margin: 0 } }, fmtDate(sel, true)), sel === today && h('span', { class: 'badge ok' }, 'Bugun')),
      h('div', { class: 'muted' }, `Jami ≈ ${fmtMin(d.totalMinutes)}${d.newWords ? ` · ${d.newWords} ta yangi so'z` : ''}`)),
      bar(d.percent / 100, 'ok'), h('div', { style: { height: '12px' } }),
      d.tasks.length ? d.tasks.map((t) => taskRow(t)) : h('p', { class: 'muted' }, 'Bu kunga topshiriq yo\'q.'));
  }
  const p = plan.plan;
  await Promise.all([drawCal(), drawDay()]);
  return h('div', {},
    h('div', { class: 'card' }, h('h1', {}, 'Shaxsiy ta\'lim traektoriyasi'),
      h('div', { class: 'row' }, h('span', { class: 'badge info' }, `Maqsad: ${p.targetCefr} / IELTS ${p.targetIelts}`), h('span', { class: 'badge' }, `Muddat: ${fmtDate(p.deadline)}`), h('span', { class: 'badge' }, `${p.hoursPerDay} soat/kun`), h('span', { class: 'badge ok' }, `${p.newWordsPerDay} yangi so'z/kun`)),
      p.weak?.length ? h('p', { class: 'muted', style: { marginTop: '8px' } }, 'Zaif mavzularga ustuvorlik berilgan.') : null,
      h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn secondary sm', onclick: async (e) => { if (!confirm('Kelajakdagi bajarilmagan rejani joriy natijalaringiz asosida qayta tuzamizmi? (Bajarilgan va o\'qituvchi topshiriqlari saqlanadi)')) return; e.target.disabled = true; await api.post('/api/plan/regenerate'); toast('Reja yangilandi'); go('#/trajectory'); } }, '♻️ Rejani yangilash'))),
    h('div', { class: 'grid g2', style: { alignItems: 'start' } }, h('div', { class: 'card' }, calBox), h('div', { class: 'card' }, dayBox)));
}
function shift(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); }
