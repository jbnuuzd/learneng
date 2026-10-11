import { api } from '../api.js';
import { h, toast, loading, fmtDate, fmtMin, TYPE_ICON, bar, mount, add } from '../ui.js';
import { audioBtn, audioPlayer, choiceList, recorderWidget, wordCountEl, resultPanel } from '../components.js';
import { go } from '../state.js';

// ---- stage renderers: each returns { el, collect(), validate(), lock(result) } ------------------------
function renderTheory(stage) {
  let i = 0;
  const body = h('div', { class: 'slide' }), dots = h('div', { class: 'row', style: { justifyContent: 'center' } });
  const prev = h('button', { class: 'btn secondary sm', type: 'button', onclick: () => show(i - 1) }, '← Oldingi');
  const next = h('button', { class: 'btn sm', type: 'button', onclick: () => show(i + 1) }, 'Keyingi →');
  function show(n) {
    i = Math.max(0, Math.min(stage.sections.length - 1, n));
    const s = stage.sections[i];
    body.replaceChildren(h('h3', {}, `${i + 1}/${stage.sections.length}. ${s.t}`), h('div', { html: s.h }));   // trusted, server-authored HTML
    dots.replaceChildren(...stage.sections.map((_, k) => h('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: k === i ? 'var(--brand)' : 'var(--line)', display: 'inline-block' } })));
    prev.disabled = i === 0; next.disabled = i === stage.sections.length - 1;
  }
  show(0);
  return { el: h('div', {}, body, dots, h('div', { class: 'row between', style: { marginTop: '12px' } }, prev, next)), collect: () => ({}), validate: () => null };
}

function renderFlash(stage) {
  let i = 0, shown = new Set();
  const card = h('div', { class: 'card flat flash' });
  const counter = h('div', { class: 'muted' });
  function show(n) {
    i = Math.max(0, Math.min(stage.words.length - 1, n)); shown.add(i);
    const w = stage.words[i];
    card.replaceChildren(h('div', { class: 'w' }, w.w), h('div', { class: 'muted' }, w.pos), h('div', { class: 'uz' }, w.uz),
      h('div', { class: 'ex' }, `“${w.ex}”`), h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } }, audioBtn(w.audio, { label: "▶ So'z" }), audioBtn(w.exAudio, { label: '▶ Gap' })));
    counter.textContent = `${i + 1} / ${stage.words.length}  ·  ko'rilgan: ${shown.size}`;
  }
  show(0);
  const list = h('details', {}, h('summary', {}, "Ro'yxat ko'rinishi"), h('table', { class: 't' }, h('tbody', {}, stage.words.map((w) => h('tr', {}, h('td', {}, h('b', {}, w.w)), h('td', { class: 'muted' }, w.pos), h('td', {}, w.uz), h('td', { class: 'muted' }, w.ex))))));
  return { el: h('div', {}, counter, card, h('div', { class: 'row between' }, h('button', { class: 'btn secondary', type: 'button', onclick: () => show(i - 1) }, '←'), h('button', { class: 'btn', type: 'button', onclick: () => show(i + 1) }, 'Keyingi →')), list),
    collect: () => ({ done: true }), validate: () => (shown.size < stage.words.length ? `Hamma so'zlarni ko'rib chiqing (${shown.size}/${stage.words.length})` : null) };
}

function renderChoice(stage) {
  const list = choiceList(stage.items);
  const parts = [];
  if (stage.passage) parts.push(h('div', {}, h('h3', {}, stage.passage.title), h('div', { class: 'passage' }, stage.passage.text), stage.passage.source && h('small', { class: 'muted' }, 'Manba: ', stage.passage.source)));
  if (stage.glossary?.length) parts.push(h('details', {}, h('summary', {}, "Foydali so'zlar"), h('ul', {}, stage.glossary.map((g) => h('li', {}, h('b', {}, g.w), ' — ', g.uz)))));
  if (stage.audio) parts.push(audioPlayer(stage.audio));
  parts.push(list.el);
  return { el: h('div', {}, parts), collect: () => ({ answers: list.answers() }),
    validate: () => (list.answers().some((a) => a == null) ? "Barcha savollarga javob bering" : null), lock: (res) => list.lock(res) };
}

function renderText(stage) {
  const inputs = [];
  const items = stage.items.map((it, i) => {
    if (stage.mode === 'reorder') {
      const built = [];
      const out = h('div', { class: 'chips', 'aria-label': 'Tuzilgan gap' });
      const pool = h('div', { class: 'chips' });
      const chips = it.words.map((w, k) => {
        const c = h('button', { type: 'button', class: 'chip', onclick: () => { if (c.classList.contains('used')) return; c.classList.add('used'); built.push(k); sync(); } }, w);
        return c;
      });
      function sync() {
        out.replaceChildren(...built.map((k, pos) => h('button', { type: 'button', class: 'chip built', onclick: () => { built.splice(pos, 1); chips[k].classList.remove('used'); sync(); } }, it.words[k])));
        if (!built.length) out.replaceChildren(h('span', { class: 'muted' }, 'Gap shu yerda paydo bo\'ladi…'));
      }
      pool.append(...chips); sync();
      inputs[i] = { get: () => built.map((k) => it.words[k]).join(' ') };
      return h('div', { class: 'q' }, h('div', { class: 'qt' }, `${i + 1}. So'zlarni to'g'ri tartibda joylashtiring:`), out, pool);
    }
    const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Javob ${i + 1}`, placeholder: it.hint || 'Javobingiz…' });
    inputs[i] = { get: () => inp.value.trim(), el: inp };
    return h('div', { class: 'q' }, h('div', { class: 'qt' }, `${i + 1}. `, it.audio ? audioBtn(it.audio, { label: '▶ Tinglash' }) : it.q), it.audio && h('div', { style: { height: '6px' } }), inp);
  });
  return { el: h('div', {}, items), collect: () => ({ answers: inputs.map((x) => x.get()) }),
    validate: () => (inputs.every((x) => !x.get()) ? 'Hech bo\'lmaganda bitta javob yozing' : null), lock: () => inputs.forEach((x) => x.el && (x.el.disabled = true)) };
}

function renderMatch(stage) {
  const sels = stage.left.map((l, i) => h('select', { 'aria-label': l }, h('option', { value: '' }, '— tanlang —'), stage.right.map((r, k) => h('option', { value: k }, r))));
  return { el: h('div', {}, stage.left.map((l, i) => h('div', { class: 'row q' }, h('b', { style: { minWidth: '140px' } }, l), sels[i]))),
    collect: () => ({ answers: sels.map((s) => (s.value === '' ? null : Number(s.value))) }), validate: () => (sels.some((s) => s.value === '') ? 'Hamma juftliklarni tanlang' : null), lock: () => sels.forEach((s) => (s.disabled = true)) };
}

function renderSentences(stage) {
  const tas = stage.items.map(() => h('textarea', { style: { minHeight: '64px' }, placeholder: stage.mode === 'make' ? 'Inglizcha gap yozing…' : 'Inglizcha tarjima…', spellcheck: 'true', lang: 'en' }));
  return { el: h('div', {}, stage.items.map((it, i) => h('div', { class: 'q' }, h('div', { class: 'qt' }, `${i + 1}. `, stage.mode === 'make' ? h('span', {}, 'So\'z: ', h('span', { class: 'badge info' }, it.prompt)) : it.prompt), tas[i]))),
    collect: () => ({ answers: tas.map((t) => t.value.trim()) }), validate: () => (tas.every((t) => !t.value.trim()) ? 'Hech bo\'lmaganda bitta gap yozing' : null), lock: () => tas.forEach((t) => (t.disabled = true)) };
}

function renderWrite(stage) {
  const ta = h('textarea', { style: { minHeight: '220px' }, lang: 'en', spellcheck: 'true', placeholder: 'Shu yerga yozing…' });
  return { el: h('div', {}, stage.info && h('div', { class: 'alert' }, h('b', {}, stage.info.title), h('div', { class: 'fb' }, stage.info.text)),
    h('div', { class: 'alert' }, stage.prompt), stage.focus && h('div', { class: 'badge info' }, `Fokus grammatika: ${stage.focus}`), ta, wordCountEl(ta, stage.words)),
    collect: () => ({ text: ta.value }), validate: () => (ta.value.trim().split(/\s+/).length < 3 ? 'Matn juda qisqa' : null), lock: () => (ta.disabled = true) };
}

function renderSpeak(stage) {
  const recs = stage.items.map((it) => recorderWidget({ seconds: it.seconds }));
  return { el: h('div', {}, stage.info && h('div', { class: 'alert' }, h('b', {}, stage.info.title)), stage.focus && h('div', { class: 'badge info' }, `Fokus grammatika: ${stage.focus}`),
    stage.items.map((it, i) => h('div', { class: 'q' }, h('div', { class: 'qt' }, `${i + 1}. `, it.prompt), recs[i].el))),
    collect: () => ({ recordings: recs.map((r) => r.get()?.base64 || null) }),
    validate: () => (recs.some((r) => r.isRecording()) ? 'Avval yozuvni to\'xtating (■)' : recs.every((r) => !r.get()) ? 'Hech bo\'lmaganda bitta javobni yozib oling' : null) };
}

function renderConfirm(stage) {
  const ta = h('textarea', { placeholder: 'Nima qildingiz? Qiyinchiliklar bo\'ldimi?' });
  return { el: h('div', {}, stage.info && h('div', { class: 'alert' }, h('b', {}, stage.info.title), h('div', { class: 'fb' }, stage.info.text)), ta),
    collect: () => ({ note: ta.value }), validate: () => (ta.value.trim().length < 3 ? 'Qisqacha hisobot yozing' : null) };
}

const RENDERERS = { theory: renderTheory, flash: renderFlash, choice: renderChoice, text: renderText, match: renderMatch, sentences: renderSentences, write: renderWrite, speak: renderSpeak, confirm: renderConfirm };

// ---- lesson runner -----------------------------------------------------------------------------------
export async function lessonView({ args }) {
  const id = args[0];
  const data = await api.get('/api/tasks/' + id);
  const { task, info, stages } = data;
  const results = { ...data.previous };
  let cur = Math.max(0, stages.findIndex((s) => !results[s.key]));
  if (cur === -1) cur = 0;

  const stepsEl = h('div', { class: 'card steps' });
  const stageEl = h('div', {});
  const done = () => stages.filter((s) => results[s.key]).length;

  function drawSteps() {
    mount(stepsEl, h('div', { class: 'row between' }, h('b', {}, `${done()}/${stages.length} bosqich`), h('small', { class: 'muted' }, fmtMin(stages.reduce((n, s) => n + s.minutes, 0)))),
      bar(done() / stages.length, 'ok'), h('div', { style: { height: '8px' } }),
      stages.map((s, i) => h('button', { class: 'step' + (i === cur ? ' cur' : '') + (results[s.key] ? ' done' : ''), onclick: () => { cur = i; draw(); } },
        h('span', { class: 'n' }, results[s.key] ? '✓' : i + 1), h('span', { class: 'grow' }, s.title), h('small', { class: 'muted' }, s.minutes + "'"))));
  }

  function finished() {
    const sc = data.task.score;
    return h('div', { class: 'card' }, h('h2', {}, '🎉 Mashg\'ulot yakunlandi'),
      h('p', {}, `${info.title} — barcha bosqichlar bajarildi.`, sc != null ? ` O'rtacha natija: ${Math.round(sc * 100)}%.` : ''),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/trajectory' }, 'Traektoriyaga qaytish'), h('a', { class: 'btn secondary', href: '#/progress' }, 'Progressni ko\'rish')));
  }

  async function draw() {
    drawSteps();
    const stage = stages[cur];
    const r = RENDERERS[stage.type];
    const card = h('div', { class: 'card' });
    add(card, h('div', { class: 'row between' }, h('h2', {}, stage.title), h('span', { class: 'badge' }, `≈ ${stage.minutes} daq.`)), stage.instructions && h('p', { class: 'muted' }, stage.instructions));
    const prev = results[stage.key];
    const comp = r(stage);
    const resultBox = h('div', {});
    add(card, comp.el, resultBox);
    const btn = h('button', { class: 'btn lg', type: 'button' }, stage.type === 'theory' ? 'Tushundim ✓' : stage.type === 'flash' ? 'Yodladim ✓' : 'Tekshirish');
    const nextBtn = () => (cur < stages.length - 1 ? h('button', { class: 'btn lg', onclick: () => { cur++; draw(); window.scrollTo(0, 0); } }, 'Keyingi bosqich →') : h('button', { class: 'btn lg', onclick: () => { stageEl.replaceChildren(finished()); drawSteps(); } }, 'Yakunlash'));
    const showResult = (res, locked = true) => {
      resultBox.replaceChildren(resultPanel(res));
      if (locked && comp.lock) comp.lock(res);
      mount(actions, nextBtn(), stage.type !== 'theory' && stage.type !== 'flash' && h('button', { class: 'btn secondary lg', onclick: () => { delete results[stage.key]; draw(); } }, 'Qayta urinish'));
    };
    const actions = h('div', { class: 'row', style: { marginTop: '14px' } }, btn);
    add(card, actions);
    btn.onclick = async () => {
      const problem = comp.validate();
      if (problem) { toast(problem, true); return; }
      btn.disabled = true; const old = btn.textContent; btn.replaceChildren(h('span', { class: 'spinner' }), ' Baholanmoqda…');
      try {
        const res = await api.post(`/api/tasks/${id}/stage/${stage.key}`, comp.collect());
        results[stage.key] = res; data.task.score = res.task.score; data.task.status = res.task.status;
        showResult(res);
        if (res.task.status === 'done' && cur === stages.length - 1) toast('Barcha bosqichlar bajarildi! 🎉');
      } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = old; }
    };
    stageEl.replaceChildren(card);
    if (prev) { showResult(prev, false); if (stage.type !== 'theory') actions.prepend(h('small', { class: 'muted' }, '✓ Bajarilgan. ')); }
  }

  const head = h('div', { class: 'card' }, h('div', { class: 'row between' },
    h('div', {}, h('div', { class: 'muted' }, `${TYPE_ICON[task.type] || ''} ${fmtDate(task.date, true)}`), h('h1', { style: { margin: 0 } }, info.title), h('div', { class: 'muted' }, info.subtitle)),
    h('div', { class: 'row' }, task.source !== 'plan' && h('span', { class: 'badge warn' }, task.source === 'remedial' ? 'Qo\'shimcha takrorlash' : 'O\'qituvchi topshirig\'i'), h('span', { class: 'badge' }, `Jami ≈ ${fmtMin(task.minutes)}`))),
    task.note && h('div', { class: 'alert', style: { marginTop: '10px' } }, '💬 ', task.note));
  await draw();
  return h('div', {}, head, h('div', { class: 'lesson' }, stepsEl, stageEl));
}
