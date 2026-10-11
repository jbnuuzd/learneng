import { api } from '../api.js';
import { h, toast, loading, mount, fmtDate, levelCard, bar } from '../ui.js';
import { audioPlayer, choiceList, recorderWidget, wordCountEl, criteriaBars, bullets, corrections } from '../components.js';
import { go } from '../state.js';

const SEC = { listening: ['🎧', 'Listening'], reading: ['📖', 'Reading'], writing: ['✍️', 'Writing'], speaking: ['🎤', 'Speaking'] };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export async function mockView({ args }) {
  return args[0] ? runner(Number(args[0])) : landing();
}

async function landing() {
  const d = await api.get('/api/mock');
  const total = (k) => Object.values(d.plans[k]).reduce((n, s) => n + s.minutes, 0);
  const start = (kind) => async (e) => {
    e.target.disabled = true;
    try { const r = await api.post('/api/mock/start', { kind }); if (r.resumed) toast('Tugallanmagan mock test davom ettiriladi'); go('#/mock/' + r.id); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
  return h('div', {},
    h('h1', {}, '📝 IELTS mock test'), h('p', { class: 'muted' }, "Haqiqiy imtihon tartibida: Listening → Reading → Writing → Speaking. Har bo'limda taymer ishlaydi va vaqt tugaganda javoblar avtomatik topshiriladi."),
    d.notice && h('div', { class: 'alert warn' }, d.notice),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'Mini mock'), h('p', {}, `≈ ${total('mini')} daqiqa: Listening ${d.plans.mini.listening.minutes}', Reading ${d.plans.mini.reading.minutes}', Writing ${d.plans.mini.writing.minutes}', Speaking ${d.plans.mini.speaking.minutes}'.`), h('p', { class: 'muted' }, "Haftada bir marta: joriy darajangizni tekshirish uchun."), h('button', { class: 'btn lg', onclick: start('mini') }, 'Mini mock boshlash')),
      h('div', { class: 'card' }, h('h2', {}, "To'liq mock"), h('p', {}, `≈ ${total('full')} daqiqa: Listening ${d.plans.full.listening.minutes}', Reading ${d.plans.full.reading.minutes}', Writing ${d.plans.full.writing.minutes}', Speaking ${d.plans.full.speaking.minutes}'.`), h('p', { class: 'muted' }, "Imtihondan oldin: 3 ta matn, 4 ta audio."), h('button', { class: 'btn lg secondary', onclick: start('full') }, "To'liq mock boshlash"))),
    d.goal && h('div', { class: 'alert' }, `Maqsadingiz: IELTS ${d.goal.target_ielts} (${d.goal.target_cefr}). Natija shu band bilan solishtiriladi.`),
    h('div', { class: 'card' }, h('h2', {}, 'Oldingi urinishlar'), d.history.length ? h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Sana', 'Tur', 'Holat', 'Umumiy band', "Bo'limlar"].map((t) => h('th', {}, t)))),
      h('tbody', {}, d.history.map((x) => h('tr', { style: { cursor: 'pointer' }, onclick: () => go('#/mock/' + x.id) }, h('td', {}, x.created.slice(0, 10)), h('td', {}, x.kind === 'full' ? "To'liq" : 'Mini'), h('td', {}, x.status === 'done' ? 'yakunlangan' : x.status === 'open' ? 'davom etmoqda' : 'to\'xtatilgan'),
        h('td', {}, x.overall != null ? h('b', {}, x.overall) : '—'), h('td', { class: 'muted' }, x.bands ? Object.entries(x.bands).filter(([, v]) => v != null).map(([k, v]) => `${k[0].toUpperCase()} ${v}`).join(' · ') : ''))))) : h('p', { class: 'muted' }, 'Hali mock test topshirilmagan.')));
}

async function runner(id) {
  const info = await api.get('/api/mock/' + id);
  const root = h('div', {});
  if (info.status === 'done') { mount(root, resultView(info.result, info)); return root; }
  let timerId = null;
  const stop = () => { clearInterval(timerId); timerId = null; };
  window.addEventListener('hashchange', stop, { once: true });

  function overview(i) {
    const next = i.order.find((s) => !i.sections[s].submitted);
    const required = ['listening', 'reading', 'writing'];
    const canFinish = required.every((s) => i.sections[s].submitted);
    mount(root, h('div', { class: 'card' }, h('h1', {}, `IELTS mock — ${i.kind === 'full' ? "to'liq" : 'mini'}`),
      i.notice && h('div', { class: 'alert warn' }, i.notice),
      h('div', { class: 'stack' }, i.order.map((s) => h('div', { class: 'row between q' }, h('div', {}, h('b', {}, `${SEC[s][0]} ${SEC[s][1]}`), h('div', { class: 'muted' }, `${i.plan[s].minutes} daqiqa`)),
        h('span', { class: 'badge ' + (i.sections[s].submitted ? 'ok' : i.sections[s].started ? 'warn' : '') }, i.sections[s].submitted ? '✓ topshirilgan' : i.sections[s].started ? 'boshlangan' : 'kutilmoqda')))),
      next ? h('div', { style: { marginTop: '14px' } }, h('p', { class: 'muted' }, "«Boshlash» bosilgach taymer yoqiladi va to'xtamaydi. Sahifani yopsangiz ham vaqt davom etadi."),
        h('button', { class: 'btn lg', onclick: () => section(next) }, `${SEC[next][1]} bo'limini ${i.sections[next].started ? 'davom ettirish' : 'boshlash'}`))
        : null,
      canFinish && h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn lg', onclick: finish }, '📊 Natijani hisoblash'), !i.sections.speaking.submitted && h('small', { class: 'muted' }, "Speaking topshirilmagan: umumiy band 3 ta bo'lim bo'yicha hisoblanadi.")),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('a', { href: '#/mock' }, '← Mock testlar'))));
  }

  async function finish(e) {
    e.target.disabled = true; mount(root, loading('Natijalar hisoblanmoqda…'));
    try { const r = await api.post(`/api/mock/${id}/finish`); mount(root, resultView(r, info)); } catch (err) { toast(err.message, true); overview(await api.get('/api/mock/' + id)); }
  }

  async function section(name) {
    mount(root, loading(`${SEC[name][1]} bo'limi tayyorlanmoqda…`));
    let c;
    try { c = await api.post(`/api/mock/${id}/section/${name}/start`); } catch (err) { toast(err.message, true); return overview(await api.get('/api/mock/' + id)); }
    let remaining = c.remainingSeconds, submitting = false, collect;
    const clock = h('b', { style: { fontSize: '1.3rem' } }, mmss(remaining));
    const bar_ = h('div', { class: 'card row between', style: { position: 'sticky', top: '8px', zIndex: 5, margin: '0 0 12px' } }, h('div', {}, h('b', {}, `${SEC[name][0]} ${SEC[name][1]}`)), h('div', {}, '⏱ ', clock));
    const body = h('div', { class: 'card' });
    let comp;
    if (name === 'listening') {
      const lists = c.clips.map((cl) => choiceList(cl.items));
      c.clips.forEach((cl, i) => body.append(h('h3', {}, cl.title), audioPlayer(cl.audio), lists[i].el));
      collect = () => ({ answers: lists.map((l) => l.answers()) });
    } else if (name === 'reading') {
      const lists = c.passages.map((p) => choiceList(p.items));
      c.passages.forEach((p, i) => body.append(h('h3', {}, `Passage ${i + 1}: ${p.title}`), h('div', { class: 'passage' }, p.text), lists[i].el));
      collect = () => ({ answers: lists.map((l) => l.answers()) });
    } else if (name === 'writing') {
      const tas = c.tasks.map(() => h('textarea', { style: { minHeight: '240px' }, lang: 'en', spellcheck: 'true' }));
      c.tasks.forEach((t, i) => body.append(h('h3', {}, t.title), h('div', { class: 'alert' }, t.prompt), tas[i], wordCountEl(tas[i], t.words)));
      collect = () => ({ texts: tas.map((t) => t.value) });
    } else {
      const recs = c.parts.map((p) => recorderWidget({ seconds: p.seconds }));
      c.parts.forEach((p, i) => {
        const prep = p.prep ? (() => { const out = h('small', { class: 'muted' }); const b = h('button', { class: 'btn secondary sm', onclick: () => { let t = p.prep; b.disabled = true; const iv = setInterval(() => { out.textContent = ` Tayyorlanish: ${t--} s`; if (t < 0) { clearInterval(iv); out.textContent = " Vaqt tugadi — gapiring!"; b.disabled = false; } }, 1000); } }, '⏳ 1 daqiqa tayyorlanish'); return h('div', {}, b, out); })() : null;
        body.append(h('div', { class: 'q' }, h('h3', {}, p.title), h('div', { class: 'alert' }, p.prompt), prep, recs[i].el));
      });
      collect = () => ({ recordings: recs.map((r) => r.get()?.base64 || null) });
    }
    const submit = async (auto) => {
      if (submitting) return; submitting = true; stop();
      mount(root, loading(auto ? "Vaqt tugadi — javoblar topshirilmoqda…" : 'Topshirilmoqda…'));
      try { await api.post(`/api/mock/${id}/section/${name}/submit`, collect()); toast(`${SEC[name][1]} topshirildi`); overview(await api.get('/api/mock/' + id)); }
      catch (err) { toast(err.message, true); overview(await api.get('/api/mock/' + id)); }
    };
    const btn = h('button', { class: 'btn lg', onclick: () => { if (confirm(`${SEC[name][1]} bo'limini topshirasizmi? Qaytib bo'lmaydi.`)) submit(false); } }, "Bo'limni topshirish");
    body.append(h('div', { class: 'row', style: { marginTop: '14px' } }, btn));
    mount(root, bar_, body);
    timerId = setInterval(() => {
      remaining -= 1; clock.textContent = mmss(Math.max(0, remaining));
      clock.style.color = remaining <= 300 ? 'var(--bad)' : '';
      if (remaining <= 0) submit(true);
    }, 1000);
  }

  overview(info);
  return root;
}

export function resultView(r, info) {
  const verdict = { reached: ['ok', '🎯 Maqsad bandiga yetdingiz'], close: ['warn', '🟡 Maqsadga yaqin (0,5 band)'], far: ['bad', '🔴 Maqsad bandidan hali uzoq'] }[r.verdict];
  return h('div', {},
    h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h1', {}, 'Mock test natijasi'), h('a', { class: 'btn secondary sm', href: '#/mock' }, '← Mock testlar')),
      h('div', { class: 'grid g4' }, h('div', { class: 'card flat stat' }, h('span', {}, 'Umumiy band'), h('div', { class: 'big-level' }, r.overall ?? '—')),
        ...['listening', 'reading', 'writing', 'speaking'].map((s) => h('div', { class: 'card flat stat' }, h('span', {}, `${SEC[s][0]} ${SEC[s][1]}`), h('b', {}, r.bands[s] ?? '—'), r.estimatedSections?.includes(s) && h('div', { class: 'badge warn' }, 'taxminiy'), r.late?.includes(s) && h('div', { class: 'badge bad' }, 'vaqtdan oshgan')))),
      verdict && h('div', { class: 'alert ' + verdict[0], style: { marginTop: '12px' } }, `${verdict[1]}: maqsad ${r.target}, farq ${r.gap > 0 ? r.gap : 0}.`),
      r.smallSample && h('div', { class: 'alert warn' }, "Savollar soni kam (haqiqiy imtihonda 40 tadan), shuning uchun Listening/Reading bandlari ±1 band aniqlikda. Aniqroq baho uchun «To'liq mock» topshiring."),
      r.partial && h('div', { class: 'alert warn' }, `Umumiy band to'liq emas: ${r.missingSections.join(', ')} bo'limi baholanmagan.`),
      r.estimatedSections?.length ? h('div', { class: 'alert warn' }, "«Taxminiy» belgilangan bo'limlar AI bo'lmagani uchun oddiy qoidalar bilan baholangan va progressga ta'sir qilmaydi.") : null),
    h('div', { class: 'card' }, h('h2', {}, '🎯 Tavsiyalar'), h('ul', {}, r.recommendations.map((x) => h('li', {}, x)))),
    h('div', { class: 'grid g2' },
      r.raw?.listening && h('div', { class: 'card flat' }, h('b', {}, '🎧 Listening'), h('p', {}, `${r.raw.listening.correct}/${r.raw.listening.total} to'g'ri → band ${r.bands.listening}`)),
      r.raw?.reading && h('div', { class: 'card flat' }, h('b', {}, '📖 Reading'), h('p', {}, `${r.raw.reading.correct}/${r.raw.reading.total} to'g'ri → band ${r.bands.reading}`))),
    r.writing?.length ? h('div', { class: 'card' }, h('h2', {}, '✍️ Writing tahlili'), r.writing.map((t, i) => h('div', { class: 'stack', style: { marginBottom: '14px' } }, h('b', {}, `Task ${i + 1}`, t.band != null ? ` — band ${t.band}` : '', ` (${t.words} so'z${t.underLength ? ", yetarli emas" : ''})`),
      t.criteria && criteriaBars(t.criteria), h('div', { class: 'fb' }, t.feedback), bullets('✅ Yutuqlar', t.strengths), bullets('⚠️ Kamchiliklar', t.weaknesses), corrections(t.corrections)))) : null,
    r.speaking?.length ? h('div', { class: 'card' }, h('h2', {}, '🎤 Speaking tahlili'), r.speaking.filter(Boolean).map((p) => h('div', { class: 'stack', style: { marginBottom: '14px' } }, h('b', {}, `Part ${p.part}`, p.band != null ? ` — band ${p.band}` : ''), h('p', { class: 'muted' }, '📝 ', p.transcript || '—'), p.criteria && criteriaBars(p.criteria), h('div', { class: 'fb' }, p.feedback), bullets('⚠️ Kamchiliklar', p.weaknesses), corrections(p.corrections)))) : null,
    h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/mock' }, 'Yangi mock test'), h('a', { class: 'btn secondary', href: '#/progress' }, 'Progress')));
}
