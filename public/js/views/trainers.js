import { api } from '../api.js';
import { h, toast, loading, mount, fmtDate, bar, toneBadge } from '../ui.js';
import { audioBtn, audioPlayer, choiceList, resultPanel, recorderWidget, criteriaBars, bullets, corrections } from '../components.js';
import { playAudio, stopAudio } from '../audio.js';
import { state, go } from '../state.js';

const sel = (id, opts, val) => h('select', { id }, opts.map(([v, t]) => h('option', { value: v, selected: v === val }, t)));
const field = (label, el, hint) => h('div', { class: 'field' }, h('label', { for: el.id }, label), el, hint && h('small', { class: 'muted' }, hint));

function header(icon, title, sub, cfg) {
  return h('div', { class: 'row between' }, h('div', {}, h('h1', {}, `${icon} ${title}`), h('p', { class: 'muted' }, sub)), !cfg.ai && h('span', { class: 'badge warn' }, 'AI ulanmagan — tayyor materiallar'));
}

// ------------------------------------------------------------------------- reading / listening
async function textTrainer(kind) {
  const cfg = await api.get('/api/trainers/config');
  const isR = kind === 'reading';
  const levelSel = sel('lv', [['', `Avto (${cfg.level} — erishgan darajangiz)`], ...cfg.levels.map((l) => [l, l])], '');
  const topicIn = h('input', { type: 'text', id: 'tp', list: 'topics', placeholder: 'Masalan: environment (bo\'sh qoldirsangiz — tasodifiy)' });
  const topics = h('datalist', { id: 'topics' }, cfg.topics.map((t) => h('option', { value: t })));
  const modeSel = sel('md', isR ? [['generate', '🤖 AI yangi matn yaratadi'], ['internet', '🌐 Internetdan (AI qidiradi va qayta yozadi)'], ['text', '📋 O\'zim matn joylayman']]
    : [['generate', '🤖 AI yangi audio yaratadi'], ['transcript', '📋 Transkript bo\'yicha (BBC va boshqalar)']], 'generate');
  const fmtSel = !isR ? sel('fm', [['dialogue', 'Dialog'], ['monologue', 'Monolog'], ['lecture', 'Ma\'ruza']], 'dialogue') : null;
  const textIn = h('textarea', { id: 'src', placeholder: isR ? 'Maqolani shu yerga joylang (60+ so\'z)…' : 'Podkast transkriptini shu yerga joylang (60+ so\'z)…', style: { display: 'none' } });
  modeSel.onchange = () => { textIn.style.display = ['text', 'transcript'].includes(modeSel.value) ? '' : 'none'; };
  const out = h('div', {}), hist = h('div', { class: 'card' });

  async function start(e) {
    e.target.disabled = true;
    mount(out, loading(isR ? 'AI matn tayyorlamoqda…' : 'AI audio tayyorlamoqda…'));
    try {
      const run = await api.post(`/api/trainers/${kind}/new`, { level: levelSel.value, topic: topicIn.value, mode: modeSel.value, format: fmtSel?.value, text: textIn.value });
      mount(out, runCard(run)); out.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { mount(out, h('div', { class: 'alert bad' }, err.message)); }
    e.target.disabled = false; loadHist();
  }
  function runCard(run) {
    const list = choiceList(run.items);
    const resBox = h('div', {});
    const btn = h('button', { class: 'btn lg' }, 'Tekshirish');
    btn.onclick = async () => {
      if (list.answers().some((a) => a == null)) return toast('Barcha savollarga javob bering', true);
      btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner' }), ' Baholanmoqda…');
      try { const res = await api.post(`/api/trainers/runs/${run.id}/submit`, { answers: list.answers() }); list.lock(res); resBox.replaceChildren(resultPanel({ ...res, extra: { transcript: res.transcript } })); btn.replaceWith(h('button', { class: 'btn lg', onclick: start }, 'Yana bitta mashq →')); loadHist(); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Tekshirish'; }
    };
    return h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, run.title), h('span', { class: 'badge info' }, `${run.level}${run.topic ? ' · ' + run.topic : ''}`)),
      run.notice && h('div', { class: 'alert warn' }, run.notice), run.generated && h('span', { class: 'badge ok' }, '🤖 AI yaratgan'),
      isR ? [h('div', { class: 'passage' }, run.passage.text), run.passage.source && h('small', { class: 'muted' }, 'Manba: ', run.passage.source), run.glossary?.length ? h('details', {}, h('summary', {}, "Foydali so'zlar"), h('ul', {}, run.glossary.map((g) => h('li', {}, h('b', {}, g.w), ' — ', g.uz)))) : null]
        : [audioPlayer(run.audio), h('p', { class: 'muted' }, "Avval savollarni o'qing, so'ng tinglang. Matn natijadan keyin ko'rsatiladi.")],
      list.el, h('div', { class: 'row', style: { marginTop: '12px' } }, btn), resBox);
  }
  async function loadHist() {
    const rows = await api.get('/api/trainers/history?kind=' + kind).catch(() => []);
    mount(hist, h('h2', {}, 'Oxirgi mashqlar'), rows.length ? h('table', { class: 't' }, h('tbody', {}, rows.slice(0, 8).map((r) => h('tr', {}, h('td', {}, r.title || '—'), h('td', {}, r.level), h('td', {}, r.score != null ? Math.round(r.score * 100) + '%' : '—'), h('td', { class: 'muted' }, r.created.slice(0, 10)))))) : h('p', { class: 'muted' }, 'Hali mashq bajarilmagan.'));
  }
  loadHist();
  const resources = !isR ? h('details', { class: 'card flat' }, h('summary', {}, '🎙️ BBC va boshqa podkastlar (tashqi havolalar)'),
    h('ul', {}, cfg.resources.map((r) => h('li', {}, h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title), h('div', { class: 'muted' }, r.note)))),
    h('small', { class: 'muted' }, "Mualliflik huquqi sababli BBC kontenti platformaga ko'chirilmaydi: audioni saytda tinglang, transkriptni «Transkript bo'yicha» rejimiga joylang — AI savollar tuzadi.")) : null;
  return h('div', {}, header(isR ? '📖' : '🎧', isR ? 'Reading trenajyor' : 'Listening trenajyor', 'Qo\'shimcha vaqt ajratib, xohlagancha mashq qiling. Har safar yangi material.', cfg),
    h('div', { class: 'card' }, h('div', { class: 'grid g2' }, field('Daraja', levelSel, 'Standart: traektoriyada erishgan darajangiz'), field('Mavzu', topicIn)), topics,
      h('div', { class: 'grid g2' }, field('Manba', modeSel), fmtSel && field('Format', fmtSel)), textIn, h('button', { class: 'btn lg', onclick: start }, '▶ Boshlash')),
    resources, out, hist);
}
export const readingTrainerView = () => textTrainer('reading');
export const listeningTrainerView = () => textTrainer('listening');

// ------------------------------------------------------------------------- speaking
export async function speakingTrainerView({ args }) {
  if (args[0]) return sessionPage(Number(args[0]));
  const cfg = await api.get('/api/speaking/setup');
  const units = cfg.units;
  let persona = 'emma';
  const grid = h('div', { class: 'grid g4' });
  const drawP = () => grid.replaceChildren(...cfg.personas.map((p) => h('button', { type: 'button', class: 'persona' + (p.id === persona ? ' on' : ''), onclick: () => { persona = p.id; drawP(); } }, h('div', { class: 'em' }, p.emoji), h('b', {}, p.name), h('small', { class: 'muted' }, p.title), h('small', { class: 'muted' }, p.desc))));
  drawP();
  const level = sel('lv', [['auto', `Avto — traektoriyadagi darajangiz`], ...cfg.levels.map((l) => [l, l])], 'auto');
  const mode = sel('md', cfg.modes.map((m) => [m.id, `${m.title} — ${m.desc}`]), 'free');
  const topic = h('input', { type: 'text', id: 'tp', placeholder: 'Ixtiyoriy: mavzu, vaziyat yoki munozara mavzusi' });
  const unitSel = sel('un', units.length ? units.map((u) => [u.id, u.title]) : [['', 'Hali mavzu o\'zlashtirilmagan']], units.at(-1)?.id || '');
  const unitField = field("O'zlashtirgan grammatika mavzusi (\"Grammatika bo'yicha\" rejimi uchun)", unitSel);
  unitField.style.display = 'none'; mode.onchange = () => { unitField.style.display = mode.value === 'grammar' ? '' : 'none'; };
  const hist = h('div', { class: 'card' });
  (((rows) => mount(hist, h('h2', {}, 'Oldingi suhbatlar'), rows.length ? h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Ustoz', 'Daraja', 'Rejim', 'Natija', 'Sana'].map((t) => h('th', {}, t)))), h('tbody', {}, rows.map((r) => h('tr', { style: { cursor: 'pointer' }, onclick: () => go('#/trainer/speaking/' + r.id) }, h('td', {}, `${r.emoji} ${r.persona}`), h('td', {}, r.level), h('td', {}, r.mode), h('td', {}, r.cefr ? `${r.cefr} · ${r.band}` : r.status === 'done' ? '—' : 'yakunlanmagan'), h('td', { class: 'muted' }, r.created.slice(0, 10)))))) : h('p', { class: 'muted' }, 'Hali suhbat bo\'lmagan.')))(cfg.history));
  return h('div', {}, header('🎤', 'Speaking trenajyor', 'AI suhbatdosh bilan jonli gaplashing. Oxirida xato, yutuq va tavsiyalar beriladi.', cfg),
    h('div', { class: 'card' }, h('h2', {}, '1. Ustozni tanlang'), grid),
    h('div', { class: 'card' }, h('h2', {}, '2. Sozlamalar'), h('div', { class: 'grid g2' }, field('Qiyinlik darajasi', level, "«Avto» — o'zlashtirgan darajangizda suhbat"), field('Rejim', mode)), unitField, field('Mavzu', topic),
      h('button', { class: 'btn lg', onclick: async (e) => {
        e.target.disabled = true; e.target.replaceChildren(h('span', { class: 'spinner' }), ' Ustoz tayyorlanmoqda…');
        try { const s = await api.post('/api/speaking/start', { persona, level: level.value, mode: mode.value, topic: topic.value, unit: unitSel.value }); if (s.aiError) toast('AI ishlamadi, tayyor savol berildi. Sabab: ' + s.aiError, true); go('#/trainer/speaking/' + s.id); }
        catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = '▶ Suhbatni boshlash'; }
      } }, '▶ Suhbatni boshlash')), hist);
}

async function sessionPage(id) {
  const s = await api.get('/api/speaking/' + id);
  const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
  const controls = h('div', {});
  const note = h('div', {});
  let busy = false;
  const bubble = (t) => {
    const b = h('div', { class: 'bubble' + (t.role === 'user' ? ' me' : '') }, t.role === 'ai' && h('div', { class: 'row between' }, h('b', {}, `${s.persona.emoji} ${s.persona.name}`), t.audio && audioBtn(t.audio, { label: '🔊', cls: 'btn ghost sm' })), h('div', {}, t.text),
      t.role === 'user' && t.notes?.length ? h('div', { class: 'note' }, t.notes.map((n) => h('div', {}, '✏️ ', h('s', {}, n.original), ' → ', h('b', {}, n.corrected), n.why ? ` (${n.why})` : ''))) : null,
      t.hint ? h('div', { class: 'note' }, '💡 ', t.hint) : null);
    chat.append(b); chat.scrollTop = chat.scrollHeight; return b;
  };
  s.turns.forEach(bubble);
  const last = s.turns.filter((t) => t.role === 'ai').at(-1);
  if (last?.audio && s.status === 'open' && s.turns.length === 1) playAudio(last.audio).catch(() => {});

  async function send(payload) {
    if (busy) return; busy = true;
    const pending = h('div', { class: 'bubble me muted' }, h('span', { class: 'spinner' }), ' Ustoz tinglamoqda…'); chat.append(pending); chat.scrollTop = chat.scrollHeight;
    try {
      const r = await api.post(`/api/speaking/${id}/turn`, payload);
      pending.remove();
      bubble({ role: 'user', text: r.transcript, notes: r.notes, hint: r.hint });
      bubble({ role: 'ai', text: r.reply, audio: r.audio });
      playAudio(r.audio).catch(() => {});
      if (r.end) note.replaceChildren(h('div', { class: 'alert ok' }, 'Suhbat tabiiy yakunga yetdi. «Yakunlash va tahlil» ni bosing.'));
    } catch (e) { pending.remove(); toast(e.message, true); }
    busy = false;
  }

  if (s.status === 'done') { controls.append(reportView(s.report)); }
  else {
    const rec = recorderWidget({ seconds: s.mode === 'ielts2' ? 120 : 45 });
    const txt = h('input', { type: 'text', placeholder: 'Yoki shu yerga yozing…', 'aria-label': 'Matnli javob' });
    const sendAudio = h('button', { class: 'btn', onclick: async () => { const d = rec.get(); if (!d) return toast('Avval gapirib yozib oling', true); await send({ wav: d.base64 }); rec.el.querySelector('audio')?.remove(); } }, 'Yuborish');
    const sendText = h('button', { class: 'btn secondary', onclick: async () => { if (!txt.value.trim()) return; const v = txt.value; txt.value = ''; await send({ text: v }); } }, 'Matn yuborish');
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendText.click(); });
    controls.append(h('div', { class: 'card flat' }, rec.el, h('div', { class: 'row', style: { marginTop: '8px' } }, sendAudio)), h('div', { class: 'row' }, h('div', { class: 'grow' }, txt), sendText),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true; e.target.replaceChildren(h('span', { class: 'spinner' }), ' Tahlil qilinmoqda…');
        try { const done = await api.post(`/api/speaking/${id}/finish`); stopAudio(); go('#/trainer/speaking/' + done.id); }
        catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = 'Yakunlash va tahlil'; }
      } }, 'Yakunlash va tahlil'), h('a', { class: 'btn secondary', href: '#/trainer/speaking' }, 'Chiqish')));
  }
  return h('div', {}, h('div', { class: 'row between' }, h('h1', {}, `${s.persona.emoji} ${s.persona.name} — ${s.persona.title}`), h('span', { class: 'badge info' }, `${s.level} · ${s.mode}`)),
    h('div', { class: 'card' }, chat), note, controls);
}

export function reportView(r) {
  if (!r) return null;
  return h('div', { class: 'card' }, h('h2', {}, 'Suhbat tahlili'),
    h('div', { class: 'row' }, r.cefr ? [h('span', { class: 'badge info' }, `Daraja: ${r.cefr}`), h('span', { class: 'badge info' }, `IELTS taxmini: ${r.band}`)] : h('span', { class: 'badge warn' }, 'AI baholamagan'), toneBadge(r.tone), h('span', { class: 'badge' }, `${r.turns} ta javob · ${r.words} so'z`)),
    h('p', { class: 'fb' }, r.summary), r.criteria && criteriaBars(r.criteria),
    bullets('✅ Yutuqlar', r.strengths), bullets('⚠️ Kamchiliklar', r.weaknesses), corrections(r.mistakes), bullets('👍 Yaxshi ishlatilgan iboralar', r.goodPhrases), bullets('🎯 Tavsiyalar', r.recommendations),
    r.vocabularySuggestions?.length ? h('div', {}, h('b', {}, "📚 Tavsiya etilgan so'zlar"), h('table', { class: 't' }, h('tbody', {}, r.vocabularySuggestions.map((v) => h('tr', {}, h('td', {}, h('b', {}, v.w)), h('td', {}, v.uz), h('td', { class: 'muted' }, v.ex)))))) : null,
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('a', { class: 'btn', href: '#/trainer/speaking' }, 'Yangi suhbat')));
}
