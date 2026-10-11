import { h, toast, pct, toneBadge, bar } from './ui.js';
import { playAudio, stopAudio, Recorder } from './audio.js';

export function audioBtn(id, { label = '▶ Tinglash', rate = 1, cls = 'btn secondary sm' } = {}) {
  const b = h('button', { class: cls, type: 'button', 'aria-label': 'Audioni tinglash' }, label);
  b.onclick = async () => {
    b.disabled = true;
    try { await playAudio(id, rate); } catch (e) { toast(e.message || 'Audio xatosi', true); }
    b.disabled = false;
  };
  return b;
}

// Audio with replay counter and speed control (exam style practice).
export function audioPlayer(id) {
  let plays = 0, speed = 1;
  const info = h('small', { class: 'muted' }, 'Hali eshitilmadi');
  const btn = h('button', { class: 'btn', type: 'button' }, '▶ Audioni tinglash');
  const sel = h('select', { style: { width: 'auto' }, 'aria-label': 'Tezlik', onchange: () => { speed = Number(sel.value); } },
    [0.75, 1, 1.25].map((v) => h('option', { value: v, selected: v === 1 }, `${v}x`)));
  btn.onclick = async () => {
    btn.disabled = true; plays++; info.textContent = `${plays} marta eshitildi`;
    try { await playAudio(id, speed); } catch (e) { toast(e.message || 'Audio xatosi', true); }
    btn.disabled = false; btn.textContent = '↻ Qayta tinglash';
  };
  return h('div', { class: 'row card flat', style: { padding: '10px 14px' } }, btn, sel, info,
    h('button', { class: 'btn ghost sm', type: 'button', onclick: stopAudio }, '■ To\'xtatish'));
}

let uid = 0;
// Multiple-choice list. Returns { el, answers(), lock(result) }.
export function choiceList(items) {
  const group = ++uid;
  const sel = items.map(() => null);
  const optEls = items.map(() => []);
  const el = h('div', {}, items.map((it, i) => h('div', { class: 'q' },
    h('div', { class: 'qt' }, `${i + 1}. `, it.q),
    it.o.map((o, k) => {
      const inp = h('input', { type: 'radio', name: `c${group}-${i}`, value: k, onchange: () => { sel[i] = k; optEls[i].forEach((x, j) => x.classList.toggle('sel', j === k)); } });
      const lab = h('label', { class: 'opt', style: { fontWeight: 400, marginBottom: '6px' } }, inp, h('span', {}, o));
      optEls[i].push(lab);
      return lab;
    }))));
  return {
    el, answers: () => sel.slice(),
    lock(result) {
      el.querySelectorAll('input').forEach((x) => { x.disabled = true; });
      result.items?.forEach((r, i) => {
        optEls[i].forEach((lab, k) => {
          const text = items[i].o[k];
          if (text === r.expected) lab.classList.add('right');
          else if (k === sel[i] && !r.ok) lab.classList.add('wrong');
        });
      });
    },
  };
}

export function recorderWidget({ seconds = 60 } = {}) {
  let rec = null, data = null, timer = null, t = 0;
  const status = h('div', { class: 'muted' }, Recorder.supported() ? 'Mikrofon tugmasini bosing va gapiring.' : "Brauzeringiz mikrofon yozishni qo'llamaydi.");
  const player = h('div', {});
  const mic = h('button', { class: 'mic', type: 'button', 'aria-label': 'Yozib olish', disabled: !Recorder.supported() }, '🎤');
  async function stop() {
    clearInterval(timer);
    try {
      const r = await rec.stop(); data = r; mic.classList.remove('rec'); mic.textContent = '🎤';
      status.textContent = `Yozildi: ${r.seconds} soniya. Yana bosib qayta yozishingiz mumkin.`;
      player.replaceChildren(h('audio', { controls: true, src: r.url, style: { width: '100%', marginTop: '8px' } }));
    } catch (e) { toast("Yozuvni qayta ishlab bo'lmadi", true); mic.classList.remove('rec'); mic.textContent = '🎤'; }
    rec = null;
  }
  mic.onclick = async () => {
    if (rec) return stop();
    try {
      rec = new Recorder(); await rec.start(); data = null; player.replaceChildren(); t = 0;
      mic.classList.add('rec'); mic.textContent = '■';
      timer = setInterval(() => { t++; status.textContent = `Yozilmoqda… ${t} s (maks. ${seconds + 30} s)`; if (t >= seconds + 30) stop(); }, 1000);
    } catch { rec = null; toast('Mikrofonga ruxsat berilmadi', true); }
  };
  return { el: h('div', { class: 'row', style: { alignItems: 'flex-start' } }, mic, h('div', { class: 'grow' }, status, player)), get: () => data, isRecording: () => !!rec };
}

export function wordCountEl(textarea, [min, max]) {
  const out = h('small', { class: 'muted' });
  const upd = () => { const n = (textarea.value.match(/[A-Za-z'’-]+/g) || []).length; out.textContent = `${n} ta so'z (tavsiya: ${min}–${max})`; out.style.color = n < min || n > max * 1.4 ? 'var(--warn)' : 'var(--ok)'; };
  textarea.addEventListener('input', upd); upd();
  return out;
}

const critName = { task: 'Task Response', coherence: 'Coherence', lexical: 'Lexical resource', grammar: 'Grammar', fluency: 'Fluency', pronunciation: 'Pronunciation', pronunciation_estimate: 'Pronunciation' };
export function criteriaBars(c) {
  return h('div', { class: 'grid g2', style: { margin: '8px 0' } }, Object.entries(c || {}).map(([k, v]) =>
    h('div', {}, h('div', { class: 'row between' }, h('small', {}, critName[k] || k), h('b', {}, String(v))), bar(v / 9))));
}
export function bullets(title, list) {
  return list?.length ? h('div', { style: { margin: '8px 0' } }, h('b', {}, title), h('ul', { style: { margin: '4px 0', paddingLeft: '1.2em' } }, list.map((x) => h('li', {}, typeof x === 'string' ? x : JSON.stringify(x))))) : null;
}
export function corrections(list) {
  return list?.length ? h('div', {}, h('b', {}, 'Tuzatishlar'), list.map((c) => h('div', { class: 'mis' }, h('div', {}, '❌ ', h('s', {}, c.original)), h('div', {}, '✅ ', h('b', {}, c.corrected)), c.why && h('small', { class: 'muted' }, c.why)))) : null;
}

export function resultPanel(res) {
  const s = res.score;
  const cls = s == null ? '' : s >= 0.8 ? 'good' : s >= 0.5 ? 'mid' : 'low';
  const ex = res.extra || {};
  const wrong = (res.items || []).filter((x) => !x.ok);
  return h('div', { class: 'result ' + cls },
    h('div', { class: 'row between' },
      s != null ? h('div', { class: 'score' }, pct(s) + '%') : h('b', {}, 'Bajarildi'),
      h('div', { class: 'row' }, res.tone && toneBadge(res.tone), h('span', { class: 'badge ' + (res.ai ? 'ok' : 'warn') }, res.ai ? '🤖 AI baholadi' : 'Oflayn tekshiruv'))),
    ex.cefr && h('div', { class: 'row' }, h('span', { class: 'badge info' }, `Daraja: ${ex.cefr}`), ex.band && h('span', { class: 'badge info' }, `IELTS taxmini: ${ex.band}`),
      ex.usedFocus != null && h('span', { class: 'badge ' + (ex.usedFocus ? 'ok' : 'warn') }, ex.usedFocus ? 'Mavzu grammatikasi ishlatildi' : 'Mavzu grammatikasi yetarli ishlatilmadi')),
    res.feedback && h('div', { class: 'fb' }, res.feedback),
    ex.criteria && criteriaBars(ex.criteria),
    bullets('✅ Yutuqlar', ex.strengths), bullets('⚠️ Kamchiliklar', ex.weaknesses), corrections(ex.corrections),
    ...(ex.answers || []).map((a, i) => h('div', { class: 'card flat' }, h('b', {}, `Savol ${i + 1}: `), a.prompt, h('p', { class: 'muted' }, '📝 ', a.transcript || '—'),
      a.cefr && h('span', { class: 'badge info' }, `${a.cefr} · IELTS ${a.band}`), a.criteria && criteriaBars(a.criteria), bullets('✅ Yutuqlar', a.strengths), bullets('⚠️ Kamchiliklar', a.weaknesses), corrections(a.corrections), bullets("🔊 Talaffuz bo'yicha", a.tips))),
    wrong.length ? h('div', {}, h('b', {}, `Xatolar (${wrong.length})`), wrong.map((x) => h('div', { class: 'mis' }, x.q && h('div', { class: 'muted' }, x.q), h('div', {}, 'Sizning javobingiz: ', h('b', {}, x.given ?? '—')), x.expected && h('div', {}, "To'g'ri javob: ", h('b', {}, x.expected)), x.comment && h('small', {}, x.comment)))) : null,
    (res.items || []).some((x) => x.aiAccepted) ? h('small', { class: 'muted' }, "AI ba'zi muqobil to'g'ri javoblaringizni ham qabul qildi.") : null,
    ex.transcript && h('details', {}, h('summary', {}, 'Audio matni (transcript)'), h('div', { class: 'passage', style: { marginTop: '8px' } }, ex.transcript)));
}
