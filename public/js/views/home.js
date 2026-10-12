import { api } from '../api.js';
import { h, fmtDate, fmtMin, bar, TYPE_ICON, toneBadge, levelCard, toast, mount } from '../ui.js';
import { state, go } from '../state.js';
import { createMascot } from '../mascot.js';
import { playAudio, stopAudio, Recorder } from '../audio.js';

export function taskRow(t, { date } = {}) {
  return h('a', { class: 'task' + (t.status === 'done' ? ' done' : ''), href: '#/task/' + t.id },
    h('div', { class: 'ico' }, t.status === 'done' ? '✅' : TYPE_ICON[t.type] || '📌'),
    h('div', { class: 'grow' }, h('b', {}, t.title), h('div', { class: 'muted' }, `${t.typeName}${t.subtitle ? ' · ' + t.subtitle : ''}`),
      (t.source !== 'plan' || t.note) && h('div', {}, t.source !== 'plan' && h('span', { class: 'badge warn' }, t.source === 'remedial' ? 'Qo\'shimcha takrorlash' : `O'qituvchi${t.by ? ': ' + t.by : ''}`), t.note && h('small', { class: 'muted' }, ' ' + t.note))),
    h('div', { style: { textAlign: 'right' } }, h('div', {}, `≈ ${fmtMin(t.minutes)}`), t.status === 'partial' && h('span', { class: 'badge warn' }, `${t.stagesDone} bosqich`), t.status === 'done' && t.score != null && h('span', { class: 'badge ok' }, Math.round(t.score * 100) + '%')));
}

// circular progress for today's plan (pure SVG)
function ring(pct) {
  const r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pct));
  return h('div', { class: 'ring', title: `Bugungi reja: ${Math.round(v)}%`, html: `<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8"/><circle cx="42" cy="42" r="${r}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" transform="rotate(-90 42 42)"/></svg><b>${Math.round(v)}%</b>` });
}

let greeted = false;   // the welcome show plays once each time the site is opened (not on every return to the home page)

function buddyCard(name, st) {
  const m = createMascot({ size: 170 });
  const say = h('div', { class: 'say' });
  const showSay = (en, uz, fix) => mount(say, h('div', {}, en), uz && h('div', { class: 'uz' }, uz), fix && h('div', { class: 'fix' }, '✏️ ' + fix));
  showSay("Xush kelibsiz, bilimdon! Bugun nimalarni o'rganamiz?");
  const log = h('div', { class: 'log' }); log.hidden = true;
  const input = h('input', { type: 'text', placeholder: 'Lingo ga yozing (inglizcha yoki o\'zbekcha)…', maxlength: 500, 'aria-label': 'Lingo ga xabar' });
  const history = []; let busy = false, muted = false;
  const logAdd = (role, text) => { log.hidden = false; const b = h('div', { class: 'bubble' + (role === 'me' ? ' me' : '') }, text); log.append(b); log.scrollTop = log.scrollHeight; return b; };
  async function send(text, wav) {
    text = (text || '').trim(); if ((!text && !wav) || busy) return;
    busy = true; input.value = ''; stopAudio(); m.talk(false); m.think(true);
    const meBubble = logAdd('me', wav ? '🎤 …' : text); if (!wav) history.push({ role: 'me', text });
    mount(say, h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
    try {
      const r = await api.post('/api/buddy/chat', wav ? { wav, history: history.slice(-8) } : { message: text, history: history.slice(-8) });
      if (wav) { meBubble.textContent = '🎤 ' + (r.transcript || '…'); history.push({ role: 'me', text: r.transcript || '' }); }
      m.think(false); history.push({ role: 'ai', text: r.reply }); logAdd('ai', r.reply); showSay(r.reply, r.uz, r.fix); m.cheer();
      if (!muted) { m.talk(true); playAudio(r.audio).catch(() => {}).finally(() => m.talk(false)); }
    } catch (e) { m.think(false); if (wav) meBubble.remove(); showSay('Oops… ' + e.message); }
    busy = false; input.focus();
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(input.value); });
  const speaker = h('button', { class: 'btn secondary sm', type: 'button', title: 'Ovozni yoqish/o\'chirish', 'aria-label': 'Ovoz', onclick: () => { muted = !muted; speaker.textContent = muted ? '🔇' : '🔊'; if (muted) { stopAudio(); m.talk(false); } } }, '🔊');
  // ---- microphone: tap to speak, tap again to send (auto-stops after 30 s)
  let rec = null, recTimer = null;
  const mic = h('button', { class: 'btn secondary sm mic-sm', type: 'button', title: 'Lingo ga gapiring', 'aria-label': 'Mikrofon', disabled: !Recorder.supported() || undefined }, '🎤');
  async function stopMic() {
    clearTimeout(recTimer); const r = rec; rec = null; mic.classList.remove('rec'); mic.textContent = '🎤'; m.think(false);
    try { const d = await r.stop(); if (d.seconds < 1) { showSay('Juda qisqa bo\'ldi. Yana urinib ko\'ring 🙂'); return; } await send('', d.base64); } catch { toast("Yozuvni qayta ishlab bo'lmadi", true); }
  }
  mic.onclick = async () => {
    if (rec) return stopMic();
    if (busy) return;
    try {
      stopAudio(); m.talk(false); m.dance(false); rec = new Recorder(); await rec.start();
      mic.classList.add('rec'); mic.textContent = '■'; m.think(true); showSay('Eshitaman… gapiring, tugatgach ■ ni bosing 🎧');
      recTimer = setTimeout(stopMic, 30000);
    } catch { rec = null; mic.classList.remove('rec'); toast('Mikrofonga ruxsat berilmadi', true); }
  };
  const sugg = ['Hello Lingo!', 'Give me a tip for IELTS speaking', 'Explain Present Perfect simply', 'Ask me a question'].map((s) => h('button', { class: 'pill', type: 'button', onclick: () => send(s) }, s));
  // ---- welcome show: Lingo drops in, bows, waves, dances and says the greeting aloud (Uzbek)
  const playBtn = h('button', { class: 'btn sm say-play', type: 'button' }, '🔊 Lingo salomini eshiting');
  playBtn.hidden = true;
  const speakGreeting = async (id) => {
    m.talk(true); m.dance(true);
    const res = await playAudio(id).catch(() => false);
    m.talk(false); m.dance(false);
    return res;
  };
  async function welcome() {
    m.greet();
    let g;
    try { g = await api.get('/api/buddy/greeting'); } catch { return; }
    await new Promise((r) => setTimeout(r, 1900));            // let the bow finish first
    if (await speakGreeting(g.audio) === 'blocked') {          // browsers block sound until the first click/tap
      playBtn.hidden = false;
      const again = async () => { playBtn.hidden = true; m.greet(); await speakGreeting(g.audio); };
      playBtn.onclick = again;
      window.addEventListener('pointerdown', () => { if (!playBtn.hidden) again(); }, { once: true });
    }
  }
  if (!greeted) { greeted = true; welcome(); } else setTimeout(() => m.wave(), 600);
  m.el.addEventListener('click', () => { m.wave(); m.cheer(); });
  m.el.style.cursor = 'pointer';
  return h('div', { class: 'card buddy' }, m.el,
    h('div', {}, say, playBtn, log, h('div', { class: 'sugg' }, sugg), h('div', { class: 'composer' }, input, mic, speaker, h('button', { class: 'btn', type: 'button', onclick: () => send(input.value) }, 'Yuborish'))));
}

const DOW = ['Ya', 'Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha'];
function weekCard(w) {
  const max = Math.max(30, ...w.days.map((d) => d.minutes));
  const diff = w.minutes - w.prevMinutes;
  return h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', {}, '📅 Bu haftam'), w.prevMinutes ? h('span', { class: 'badge ' + (diff >= 0 ? 'ok' : 'warn') }, `${diff >= 0 ? '▲ +' : '▼ '}${diff} daq. (o'tgan haftaga nisbatan)`) : null),
    h('div', { class: 'grid g4' }, [[fmtMin(w.minutes), "o'qilgan vaqt"], [`${w.activeDays}/7`, 'faol kun'], [w.newWords, "yangi so'z"], [`${w.done}/${w.planned}`, 'topshiriq']].map(([b, s]) => h('div', { class: 'card flat stat' }, h('b', {}, b), h('span', {}, s)))),
    h('div', { class: 'weekbars' }, w.days.map((d) => h('div', { class: 'wb' + (d.date === w.to ? ' today' : '') , title: `${d.date}: ${d.minutes} daq.` }, h('div', { class: 'col' }, h('i', { style: { height: Math.round((d.minutes / max) * 100) + '%' } })), h('small', {}, DOW[new Date(d.date + 'T12:00:00').getDay()])))),
    h('p', { style: { margin: '10px 0 0' } }, '🦉 ' + w.note));
}

export async function homeView() {
  const [plan, prog, mats, week] = await Promise.all([api.get('/api/plan'), api.get('/api/progress'), api.get('/api/materials').catch(() => []), api.get('/api/me/week').catch(() => null)]);
  const msgs = (await api.get('/api/messages').catch(() => [])).filter((m) => !m.read);
  const me = state.me, today = plan.today;
  const day = plan.todayView;
  const goal = plan.goal;
  const daysLeft = goal ? Math.max(0, Math.round((Date.parse(goal.deadline) - Date.parse(today)) / 864e5)) : null;
  const st = prog.stats;
  return h('div', {},
    h('div', { class: 'hero' }, h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'muted' }, fmtDate(today, true)), h('h1', {}, `Salom, ${me.user.name.split(' ')[0]}! 👋`),
      h('div', {}, daysLeft != null && h('small', {}, `Maqsad: ${goal.target_cefr} · IELTS ${goal.target_ielts} · ${daysLeft} kun qoldi`))),
      h('div', { class: 'row' }, h('small', {}, 'Fikr-mulohaza:'), toneBadge(me.today.tone))),
      day && h('div', { class: 'progress' }, h('div', { class: 'row between' }, h('small', {}, "Bugungi reja"), h('small', {}, `${fmtMin(day.doneMinutes)} / ${fmtMin(day.totalMinutes)} · ${Math.round(day.percent)}%`)), bar(day.percent / 100)),
      day && ring(day.percent)),
    buddyCard(me.user.name.split(' ')[0], st),
    week ? weekCard(week) : null,
    msgs.length ? h('div', { class: 'card flat' }, h('b', {}, `💬 O'qituvchidan xabar${msgs.length > 1 ? 'lar' : ''}`), msgs.map((m) => h('div', { class: 'q' }, h('div', { class: 'fb' }, m.text), h('small', { class: 'muted' }, `${m.teacher} · ${m.created_at.slice(0, 16)}`))),
      h('button', { class: 'btn secondary sm', onclick: async (e) => { e.target.disabled = true; await api.post('/api/messages/read'); e.target.closest('.card').remove(); } }, "O'qidim")) : null,
    st.missed >= 3 && h('div', { class: 'alert warn' }, h('div', { class: 'row between' }, h('span', {}, `Siz ${st.missed} ta topshiriqni o'tkazib yubordingiz. Rejani bugundan qayta tuzamizmi?`),
      h('button', { class: 'btn sm', onclick: async (e) => { e.target.disabled = true; await api.post('/api/plan/regenerate'); toast('Reja yangilandi'); go('#/trajectory'); } }, 'Qayta rejalash'))),
    h('div', { class: 'grid g4' },
      levelCard('Hozirgi daraja', prog.overall),
      goal ? h('div', { class: 'card flat stat' }, h('span', {}, 'Maqsad'), h('div', { class: 'big-level' }, goal.target_cefr), h('div', { class: 'muted' }, `IELTS ${goal.target_ielts} · ${daysLeft} kun qoldi`)) : null,
      h('div', { class: 'card flat stat' }, h('b', {}, `🔥 ${st.streak}`), h('span', {}, 'kun ketma-ket')),
      h('div', { class: 'card flat stat' }, h('b', {}, st.wordsLearned), h('span', {}, "o'rganilgan so'z"))),
    h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, "Bugungi mashg'ulotlar"), day && h('span', { class: 'muted' }, `${fmtMin(day.doneMinutes)} / ${fmtMin(day.totalMinutes)}`)),
      day ? [bar(day.percent / 100, 'ok'), h('div', { style: { height: '12px' } }), day.tasks.length ? day.tasks.map((t) => taskRow(t)) : h('p', { class: 'muted' }, 'Bugun topshiriq yo\'q — dam oling yoki trenajyorlardan foydalaning.'),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/trajectory' }, 'Traektoriyani ochish'), h('a', { class: 'btn secondary', href: '#/trainer/speaking' }, '🎤 Speaking trenajyor'))]
        : h('p', {}, 'Traektoriya hali yaratilmagan. ', h('a', { href: '#/goal' }, 'Maqsad belgilash'))),
    mats.length ? h('div', { class: 'card' }, h('h2', {}, "O'qituvchingiz materiallari"), mats.slice(0, 5).map((m) => h('div', { class: 'row between q' }, h('div', {}, h('b', {}, m.title), m.description && h('div', { class: 'muted' }, m.description)), h('a', { class: 'btn secondary sm', href: `/api/materials/${m.id}/download` }, '⬇ Yuklab olish')))) : null);
}
