import { api } from '../api.js';
import { h, toast, loading, bar, levelCard, skillBars, mount } from '../ui.js';
import { audioPlayer, choiceList, recorderWidget, wordCountEl } from '../components.js';
import { state, go, refreshMe } from '../state.js';

export async function diagnosticView() {
  const root = h('div', {});
  async function load() {
    mount(root, loading());
    const d = await api.get('/api/diagnostic');
    if (d.status === 'done' && d.result) return mount(root, resultView(d.result));
    const todo = d.sections.find((s) => !s.done);
    if (!todo) return finish();
    mount(root, intro(d), sectionCard(d, todo));
  }
  async function finish() {
    mount(root, loading('Natijalar hisoblanmoqda…'));
    try { const r = await api.post('/api/diagnostic/finish'); await refreshMe(); mount(root, resultView(r)); }
    catch (e) { toast(e.message, true); mount(root, h('div', { class: 'alert bad' }, e.message), h('button', { class: 'btn', onclick: load }, 'Qayta urinish')); }
  }

  function intro(d) {
    const total = d.sections.reduce((n, s) => n + s.minutes, 0);
    return h('div', { class: 'card' }, h('h1', {}, 'Boshlang\'ich diagnostika'),
      h('p', {}, `Bu test sizning grammatika, lug'at, reading, listening, writing va speaking darajangizni aniqlaydi (≈ ${total} daqiqa). Natija asosida CEFR va IELTS darajangiz belgilanadi, so'ng shaxsiy traektoriya tuziladi.`),
      h('div', { class: 'row' }, d.sections.map((s, i) => h('span', { class: 'badge ' + (s.done ? 'ok' : '') }, `${s.done ? '✓' : i + 1}. ${s.title} · ${s.minutes}'`))),
      h('p', { class: 'muted', style: { marginTop: '10px' } }, "Maslahat: tinch joyda, quloqchin va mikrofon bilan bajaring. Hech qanday lug'at yoki tarjimondan foydalanmang — natija haqiqiy darajangizni ko'rsatishi uchun."));
  }

  function sectionCard(d, sec) {
    const c = d.content[sec.id];
    const box = h('div', { class: 'card' });
    const submitBtn = (collect, validate) => {
      const b = h('button', { class: 'btn lg', type: 'button' }, 'Bo\'limni topshirish');
      b.onclick = async () => {
        const problem = validate?.(); if (problem && !confirm(problem + '\n\nBaribir topshirasizmi?')) return;
        b.disabled = true; b.replaceChildren(h('span', { class: 'spinner' }), ' Yuborilmoqda…');
        try { await api.post('/api/diagnostic/section/' + sec.id, collect()); toast(`«${sec.title}» topshirildi`); await load(); }
        catch (e) { toast(e.message, true); b.disabled = false; b.textContent = 'Bo\'limni topshirish'; }
      };
      return b;
    };
    box.append(h('div', { class: 'row between' }, h('h2', {}, `${d.sections.indexOf(sec) + 1}/${d.sections.length}. ${sec.title}`), h('span', { class: 'badge' }, `≈ ${sec.minutes} daq.`)));
    if (sec.id === 'grammar' || sec.id === 'vocab') {
      box.append(h('p', { class: 'muted' }, 'Har bir gap uchun eng to\'g\'ri variantni tanlang.'));
      const list = choiceList(c.items);
      box.append(list.el, submitBtn(() => ({ answers: list.answers() }), () => (list.answers().some((a) => a == null) ? 'Ba\'zi savollarga javob berilmagan.' : null)));
    } else if (sec.id === 'reading') {
      const lists = c.passages.map((p) => ({ p, list: choiceList(p.items) }));
      lists.forEach(({ p, list }) => box.append(h('h3', {}, p.title), h('div', { class: 'passage' }, p.text), list.el));
      box.append(submitBtn(() => ({ answers: lists.map((x) => x.list.answers()) }), () => (lists.some((x) => x.list.answers().some((a) => a == null)) ? 'Ba\'zi savollarga javob berilmagan.' : null)));
    } else if (sec.id === 'listening') {
      box.append(h('p', { class: 'muted' }, 'Avval savollarni o\'qing, so\'ng audioni tinglang. Audio ni 2 martagacha tinglash tavsiya etiladi.'));
      const lists = c.clips.map((cl) => ({ cl, list: choiceList(cl.items) }));
      lists.forEach(({ cl, list }, i) => box.append(h('h3', {}, `Audio ${i + 1}`), audioPlayer(cl.audio), list.el));
      box.append(submitBtn(() => ({ answers: lists.map((x) => x.list.answers()) }), () => (lists.some((x) => x.list.answers().some((a) => a == null)) ? 'Ba\'zi savollarga javob berilmagan.' : null)));
    } else if (sec.id === 'writing') {
      const tas = c.tasks.map(() => h('textarea', { style: { minHeight: '200px' }, lang: 'en', spellcheck: 'true' }));
      c.tasks.forEach((t, i) => box.append(h('h3', {}, `Task ${i + 1}`), h('div', { class: 'alert' }, t.prompt), tas[i], wordCountEl(tas[i], t.words)));
      box.append(h('p', { class: 'muted' }, 'AI sizning yozuvingizni IELTS mezonlari (Task Response, Coherence, Lexical Resource, Grammar) bo\'yicha baholaydi.'), submitBtn(() => ({ texts: tas.map((t) => t.value) }), () => (tas.some((t) => t.value.trim().split(/\s+/).length < 20) ? 'Ba\'zi matnlar juda qisqa.' : null)));
    } else if (sec.id === 'speaking') {
      const recs = c.tasks.map((t) => recorderWidget({ seconds: t.seconds }));
      c.tasks.forEach((t, i) => box.append(h('div', { class: 'q' }, h('div', { class: 'qt' }, `${i + 1}. `, t.prompt, h('small', { class: 'muted' }, `  (≈ ${t.seconds} soniya)`)), recs[i].el)));
      box.append(h('div', { class: 'row' }, submitBtn(() => ({ recordings: recs.map((r) => r.get()?.base64 || null) }), () => (recs.some((r) => r.isRecording()) ? 'Yozuv hali davom etmoqda.' : recs.every((r) => !r.get()) ? 'Hech narsa yozilmadi — speaking bahosi taxminiy hisoblanadi.' : null))));
      box.append(h('small', { class: 'muted' }, 'Mikrofon ishlamasa, bo\'limni bo\'sh topshirishingiz mumkin — speaking darajasi boshqa bo\'limlar asosida taxminan belgilanadi va keyin trenajyorda aniqlashtiriladi.'));
    }
    return box;
  }

  function resultView(r) {
    const sk = Object.entries(r.skills).map(([k, v]) => ({ skill: k, ...v }));
    return h('div', {},
      h('div', { class: 'card' }, h('h1', {}, 'Diagnostika natijasi'),
        h('div', { class: 'grid g3' }, levelCard('Umumiy daraja', r.overall), h('div', { class: 'card flat stat' }, h('span', {}, 'IELTS (taxminiy)'), h('div', { class: 'big-level' }, r.overall.ielts)), h('div', { class: 'card flat' }, h('b', {}, 'Kuchli tomonlar'), h('p', {}, r.strongest.join(', ')), h('b', {}, 'Rivojlantirish kerak'), h('p', {}, r.weakest.join(', ')))),
        !r.aiAssessedWritingSpeaking && h('div', { class: 'alert warn' }, "Writing/Speaking sun'iy intellekt orqali baholanmadi (API kaliti ulanmagan), shuning uchun bu ikki ko'nikma taxminiy. Kalit qo'shilgach, mashg'ulotlar davomida aniqlashadi."),
        r.speakingEstimated && h('div', { class: 'alert' }, 'Speaking darajasi boshqa bo\'limlar asosida taxminan belgilandi.')),
      h('div', { class: 'card' }, h('h2', {}, "Ko'nikmalar bo'yicha"), skillBars(sk)),
      r.weakTopics.length ? h('div', { class: 'card' }, h('h2', {}, 'Zaif grammatika mavzulari'), h('p', { class: 'muted' }, 'Traektoriyada bu mavzulariga ustuvorlik beriladi:'), h('div', { class: 'row' }, r.weakTopics.map((t) => h('span', { class: 'badge warn' }, t.title)))) : null,
      r.sections.writing?.tasks?.some(Boolean) && h('div', { class: 'card' }, h('h2', {}, 'Writing tahlili'), r.sections.writing.tasks.map((t, i) => t && h('div', { class: 'stack' }, h('b', {}, `Task ${i + 1}`, t.cefr ? ` — ${t.cefr}, IELTS ${t.band}` : ''), h('div', { class: 'fb' }, t.feedback)))),
      h('div', { class: 'row' }, h('a', { class: 'btn lg', href: '#/goal' }, 'Maqsad belgilash →'), h('button', { class: 'btn secondary', onclick: async () => { if (confirm('Diagnostikani qayta topshirasizmi? Joriy daraja yangi natija bilan yangilanadi.')) { await api.post('/api/diagnostic/restart'); load(); } } }, 'Qayta topshirish')));
  }

  await load();
  return root;
}
