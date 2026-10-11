import { api, localDate } from '../api.js';
import { h, toast, loading, mount, fmtDate, fmtMin, bar, levelCard, skillBars, toneBadge, TONE_LABEL, TYPE_ICON, addDaysStr, modal, SKILL_NAME } from '../ui.js';
import { state, go } from '../state.js';
import { historyChart, analysisView } from './progress.js';
import { reportView } from './trainers.js';
import { bullets, corrections, criteriaBars } from '../components.js';

const TABS = [['overview', 'Umumiy'], ['feedback', 'Fikr-mulohaza'], ['tasks', 'Topshiriqlar'], ['plan', 'Traektoriya'], ['progress', 'Progress'], ['analysis', 'AI tahlil'], ['materials', 'Materiallar'], ['notes', 'Izohlar']];
const field = (label, el) => h('div', { class: 'field' }, h('label', {}, label), el);
const sel = (opts, val) => h('select', {}, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(val) }, t)));

export async function teacherHomeView() {
  const d = await api.get('/api/teacher/students');
  const copy = () => navigator.clipboard?.writeText(d.inviteCode).then(() => toast('Kod nusxalandi'));
  return h('div', {},
    h('div', { class: 'row between' }, h('h1', {}, "O'quvchilar"), h('div', { class: 'row' }, h('a', { class: 'btn secondary sm', href: '/api/teacher/export.csv' }, '⬇ CSV'), h('div', { class: 'card flat', style: { margin: 0, padding: '8px 14px' } }, h('small', { class: 'muted' }, 'Ulanish kodi: '), h('b', { style: { letterSpacing: '.08em' } }, d.inviteCode), ' ', h('button', { class: 'btn ghost sm', onclick: copy }, 'Nusxalash')))),
    d.students.length ? h('div', { class: 'grid g2' }, d.students.map((s) => h('a', { class: 'card', href: '#/t/student/' + s.id, style: { color: 'inherit', textDecoration: 'none' } },
      h('div', { class: 'row between' }, h('div', {}, h('b', { style: { fontSize: '1.1rem' } }, s.name), h('div', { class: 'muted' }, s.email)), s.level ? h('div', { class: 'big-level', style: { fontSize: '1.6rem' } }, s.level.cefr) : h('span', { class: 'badge warn' }, 'Diagnostika yo\'q')),
      h('div', { class: 'row', style: { margin: '8px 0' } }, s.goal && h('span', { class: 'badge info' }, `Maqsad ${s.goal.target_cefr} · IELTS ${s.goal.target_ielts}`), toneBadge(s.tone), h('span', { class: 'badge' }, `🔥 ${s.stats.streak}`), h('span', { class: 'badge' }, `${s.stats.wordsLearned} so'z`)),
      h('div', { class: 'row between' }, h('small', { class: 'muted' }, 'Bugungi bajarilish'), h('small', {}, s.today.percent + '%')), bar(s.today.percent / 100, 'ok'),
      s.alerts.slice(0, 2).map((a) => h('div', { class: 'alert ' + (a.level === 'danger' ? 'bad' : 'warn'), style: { marginTop: '8px', marginBottom: 0 } }, a.text))))) : h('div', { class: 'card' }, h('p', {}, "Hozircha o'quvchilar yo'q."), h('p', { class: 'muted' }, `O'quvchilar ro'yxatdan o'tishda yoki profilida ${d.inviteCode} kodini kiritsa, bu yerda paydo bo'ladi.`)));
}

export async function teacherStudentView({ args }) {
  const id = args[0];
  let tab = args[1] || 'overview';
  const data = await api.get('/api/teacher/students/' + id);
  const body = h('div', {});
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const refresh = async () => { const fresh = await api.get('/api/teacher/students/' + id); Object.assign(data, fresh); draw(); };

  function draw() {
    tabsEl.replaceChildren(...TABS.map(([k, t]) => h('button', { class: tab === k ? 'on' : '', role: 'tab', onclick: () => { tab = k; history.replaceState(null, '', `#/t/student/${id}/${k}`); draw(); } }, t)));
    mount(body, VIEWS[tab]());
  }

  const VIEWS = {
    overview: () => h('div', {},
      data.alerts.map((a) => h('div', { class: 'alert ' + (a.level === 'danger' ? 'bad' : 'warn') }, a.text)),
      h('div', { class: 'grid g4' }, levelCard('Hozirgi daraja', data.level), data.goal ? h('div', { class: 'card flat stat' }, h('span', {}, 'Maqsad'), h('div', { class: 'big-level' }, data.goal.target_cefr), h('div', { class: 'muted' }, `IELTS ${data.goal.target_ielts} · ${fmtDate(data.goal.deadline)}`)) : null,
        h('div', { class: 'card flat stat' }, h('b', {}, `🔥 ${data.stats.streak}`), h('span', {}, 'kun ketma-ket')), h('div', { class: 'card flat stat' }, h('b', {}, data.stats.completionRate != null ? data.stats.completionRate + '%' : '—'), h('span', {}, 'reja bajarilishi'))),
      h('div', { class: 'card' }, h('h2', {}, "Ko'nikmalar"), skillBars(data.skills)),
      data.suggestions.length ? h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, '💡 Tavsiya etilgan choralar'), h('button', { class: 'btn sm', onclick: async (e) => { e.target.disabled = true; const r = await api.post(`/api/teacher/students/${id}/auto-adjust`); toast(`Qo'llandi: ${r.remedial} ta takrorlash${r.replanned ? ', reja qayta tuzildi' : ''}`); refresh(); } }, 'Hammasini qo\'llash')),
        data.suggestions.map((s) => h('div', { class: 'q' }, h('div', { class: 'row between' }, h('div', {}, h('b', {}, s.title), h('div', { class: 'muted' }, s.why)),
          h('button', { class: 'btn secondary sm', onclick: async () => { if (s.code === 'remedial') await api.post(`/api/teacher/students/${id}/remedial`, { unit: s.unit }); else await api.post(`/api/teacher/students/${id}/replan`, {}); toast('Qo\'llandi ✓'); refresh(); } }, 'Qo\'llash'))))) : null,
      h('div', { class: 'card flat row between' }, h('div', {}, h('b', {}, 'Hisob'), h('div', { class: 'muted' }, "O'quvchi parolini unutsa, vaqtinchalik parol bering (bir marta ko'rsatiladi).")),
        h('div', { class: 'row' }, h('a', { class: 'btn secondary sm', href: `/api/teacher/students/${id}/export.csv` }, '⬇ Natijalar (CSV)'),
          h('button', { class: 'btn secondary sm', onclick: async () => { if (!confirm("Parol tiklansinmi? O'quvchi barcha qurilmalardan chiqariladi.")) return; const r = await api.post(`/api/teacher/students/${id}/reset-password`); modal('Vaqtinchalik parol', h('div', {}, h('p', {}, "Buni o'quvchiga bering va profilida o'zgartirishini so'rang:"), h('div', { class: 'big-level', style: { letterSpacing: '.06em', wordBreak: 'break-all' } }, r.password))); } }, '🔑 Parolni tiklash'))),
      data.diagnostic && h('div', { class: 'card' }, h('h2', {}, 'Diagnostika natijasi'), h('p', {}, `Umumiy: ${data.diagnostic.overall.cefr} / IELTS ${data.diagnostic.overall.ielts}. Kuchli: ${data.diagnostic.strongest.join(', ')}. Zaif: ${data.diagnostic.weakest.join(', ')}.`),
        data.weakTopics.length ? h('div', { class: 'row' }, data.weakTopics.map((t) => h('span', { class: 'badge warn' }, t.title))) : null),
      data.speakingSessions.length ? h('div', { class: 'card' }, h('h2', {}, 'Speaking trenajyor suhbatlari'), h('table', { class: 't' }, h('tbody', {}, data.speakingSessions.map((s) => h('tr', { style: { cursor: 'pointer' }, onclick: async () => { const full = await api.get(`/api/teacher/students/${id}/speaking/${s.id}`); modal(`${full.persona?.name} · ${full.level}`, h('div', {}, h('div', { class: 'chat' }, full.turns.map((t) => h('div', { class: 'bubble' + (t.role === 'user' ? ' me' : '') }, t.text))), reportView(full.report))); } }, h('td', {}, s.persona), h('td', {}, s.level), h('td', {}, s.mode), h('td', {}, s.cefr ? `${s.cefr} · ${s.band}` : s.status), h('td', { class: 'muted' }, s.created.slice(0, 10))))))) : null),

    feedback: () => {
      const def = sel(Object.entries(data.tones).map(([k, v]) => [k, v.label]), data.student.tone);
      const dt = h('input', { type: 'date', value: localDate() }), ot = sel(Object.entries(data.tones).map(([k, v]) => [k, v.label]), 'positive');
      return h('div', {},
        h('div', { class: 'card' }, h('h2', {}, 'Standart fikr-mulohaza uslubi'), h('p', { class: 'muted' }, "AI mashg'ulotlardan keyin o'quvchiga shu uslubda fikr bildiradi."),
          h('div', { class: 'grid g3' }, Object.entries(data.tones).map(([k, v]) => h('div', { class: 'card flat' }, h('b', {}, v.label), h('p', { class: 'muted' }, v.uz)))),
          h('div', { class: 'row' }, def, h('button', { class: 'btn', onclick: async () => { await api.put(`/api/teacher/students/${id}/tone`, { tone: def.value }); toast('Saqlandi ✓'); refresh(); } }, 'Saqlash'))),
        h('div', { class: 'card' }, h('h2', {}, 'Muayyan kun uchun uslub'), h('p', { class: 'muted' }, 'Masalan, bugun o\'quvchini rag\'batlantirish yoki aksincha qat\'iyroq bo\'lish kerak bo\'lsa.'),
          h('div', { class: 'row' }, dt, ot, h('button', { class: 'btn', onclick: async () => { await api.put(`/api/teacher/students/${id}/tone`, { tone: ot.value, date: dt.value }); toast('Saqlandi ✓'); refresh(); } }, 'Belgilash')),
          data.tonesOverrides.length ? h('table', { class: 't' }, h('tbody', {}, data.tonesOverrides.map((o) => h('tr', {}, h('td', {}, fmtDate(o.date)), h('td', {}, toneBadge(o.tone)), h('td', {}, h('button', { class: 'btn ghost sm', onclick: async () => { await api.del(`/api/teacher/students/${id}/tone/${o.date}`); refresh(); } }, 'O\'chirish')))))) : null),
        h('div', { class: 'alert' }, 'Bugungi samarali uslub: ', toneBadge(data.student.todayTone)));
    },

    tasks: () => {
      const form = taskForm(id, refresh);
      return h('div', {}, h('div', { class: 'card' }, h('h2', {}, "Qo'shimcha topshiriq berish"), form),
        h('div', { class: 'card' }, h('h2', {}, 'Yaqin kunlardagi topshiriqlar'), data.upcoming.length ? data.upcoming.map((d) => h('details', { open: d.date === localDate() },
          h('summary', {}, h('b', {}, fmtDate(d.date, true)), ` · ${fmtMin(d.totalMinutes)} · ${d.percent}%`),
          d.tasks.map((t) => h('div', { class: 'task' }, h('div', { class: 'ico' }, t.status === 'done' ? '✅' : TYPE_ICON[t.type]), h('div', { class: 'grow' }, h('b', {}, t.title), h('div', { class: 'muted' }, `${t.typeName} · ${fmtMin(t.minutes)}${t.score != null ? ' · ' + Math.round(t.score * 100) + '%' : ''}`), t.source !== 'plan' && h('span', { class: 'badge warn' }, t.source === 'remedial' ? 'takrorlash' : 'sizning topshirig\'ingiz')),
            t.source !== 'plan' && t.status !== 'done' && h('button', { class: 'btn ghost sm', onclick: async () => { await api.del(`/api/teacher/students/${id}/tasks/${t.id}`); toast('O\'chirildi'); refresh(); } }, 'O\'chirish'))))) : h('p', { class: 'muted' }, 'Rejalashtirilgan topshiriq yo\'q.')));
    },

    plan: () => {
      const g = data.goal;
      if (!g) return h('div', { class: 'alert' }, "O'quvchi hali maqsad belgilamagan.");
      const hrs = h('input', { type: 'number', min: 1.5, max: 10, step: 0.5, value: g.hours_per_day });
      const tc = sel([['', 'o\'zgarmasin'], ...['B1', 'B2', 'C1', 'C2'].map((c) => [c, c])], '');
      const dl = h('input', { type: 'date', value: g.deadline });
      return h('div', {},
        h('div', { class: 'card' }, h('h2', {}, 'Joriy reja'), h('div', { class: 'row' }, h('span', { class: 'badge info' }, `${g.target_cefr} / IELTS ${g.target_ielts}`), h('span', { class: 'badge' }, `${fmtDate(g.start_date)} → ${fmtDate(g.deadline)}`), h('span', { class: 'badge' }, `${g.hours_per_day} soat/kun`), h('span', { class: 'badge ok' }, `${data.plan?.newWordsPerDay} so'z/kun`)),
          data.plan?.weak?.length ? h('p', { class: 'muted' }, 'Zaif mavzular rejada ustuvor.') : null),
        h('div', { class: 'card' }, h('h2', {}, "Traektoriyaga o'zgartirish kiritish"), h('p', { class: 'muted' }, "Kelajakdagi bajarilmagan rejalar qayta tuziladi. Bajarilgan va qo'shimcha topshiriqlar saqlanadi."),
          h('div', { class: 'grid g3' }, field('Kuniga soat', hrs), field('Maqsad darajasi', tc), field('Imtihon sanasi', dl)),
          h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { await api.post(`/api/teacher/students/${id}/replan`, { hoursPerDay: Number(hrs.value), targetCefr: tc.value || undefined, deadline: dl.value }); toast('Traektoriya yangilandi ✓'); refresh(); } catch (er) { toast(er.message, true); } e.target.disabled = false; } }, 'Rejani qayta tuzish')),
        h('div', { class: 'card' }, h('h2', {}, "Mavzu bo'yicha qo'shimcha takrorlash"), h('p', { class: 'muted' }, "Tanlangan mavzu bo'yicha 3 ta intervalli takrorlash (+1, +2, +4 kun) qo'shiladi."), remedialForm(id, refresh)));
    },

    progress: () => h('div', {},
      h('div', { class: 'card' }, h('h2', {}, 'Rivojlanish dinamikasi'), historyChart(data.history)),
      h('div', { class: 'card' }, h('h2', {}, "Oxirgi mashq natijalari va AI fikrlari"), data.recent.length ? h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Sana', 'Ko\'nikma', 'Mavzu / bosqich', 'Natija', 'Uslub', 'AI fikri'].map((t) => h('th', {}, t)))), h('tbody', {}, data.recent.map((a) => h('tr', {}, h('td', { class: 'muted' }, a.at.slice(5, 16)), h('td', {}, SKILL_NAME[a.skill] || a.skill || '—'), h('td', {}, `${a.topic || ''} ${a.stage}`), h('td', {}, a.score != null ? Math.round(a.score * 100) + '%' : '—'), h('td', {}, a.tone && toneBadge(a.tone)), h('td', { class: 'muted', style: { maxWidth: '300px' } }, (a.feedback || '').slice(0, 160)))))) : h('p', { class: 'muted' }, 'Hali mashq yo\'q.')),
      h('div', { class: 'card' }, h('h2', {}, "Faollik"), h('div', { class: 'grid g4' }, [[data.stats.tasksDone, 'bajarilgan'], [fmtMin(data.stats.minutesDone), 'vaqt'], [data.stats.wordsLearned, "o'rganilgan so'z"], [data.stats.missed, 'o\'tkazib yuborilgan']].map(([v, t]) => h('div', { class: 'card flat stat' }, h('b', {}, v), h('span', {}, t)))))),

    analysis: () => {
      const box = h('div', {});
      const b = h('button', { class: 'btn lg', onclick: async () => { b.disabled = true; mount(box, loading('AI tahlil qilmoqda…')); try { mount(box, analysisView(await api.get(`/api/teacher/students/${id}/analysis`))); } catch (e) { mount(box, h('div', { class: 'alert bad' }, e.message)); } b.disabled = false; } }, "🔍 Maqsadga erishish imkoniyatini tahlil qilish");
      return h('div', { class: 'card' }, h('h2', {}, 'AI tahlil'), h('p', { class: 'muted' }, "O'quvchi rejadagi mavzularni o'zlashtirib, maqsadiga haqiqatan yeta oladimi? Vaqt, lug'at, grammatika qamrovi va bajarish darajasi tahlil qilinadi."), b, h('div', { style: { height: '12px' } }), box);
    },

    materials: () => h('div', {}, h('div', { class: 'card' }, h('h2', {}, 'Material yuklash'), uploadForm(id, refresh)),
      h('div', { class: 'card' }, h('h2', {}, "Bu o'quvchi uchun materiallar"), materialList(data.materials, refresh))),

    notes: () => {
      const ta = h('textarea', { placeholder: 'Izoh (faqat siz ko\'rasiz)…', style: { minHeight: '90px' } });
      return h('div', { class: 'card' }, h('h2', {}, 'Shaxsiy izohlar'), ta, h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: async () => { await api.post(`/api/teacher/students/${id}/notes`, { text: ta.value }); toast('Saqlandi'); refresh(); } }, 'Saqlash'),
        data.notes.map((n) => h('div', { class: 'q' }, h('div', { class: 'fb' }, n.text), h('small', { class: 'muted' }, n.created_at.slice(0, 16)))));
    },
  };

  draw();
  return h('div', {}, h('a', { href: '#/t' }, '← Barcha o\'quvchilar'),
    h('div', { class: 'row between', style: { margin: '8px 0 12px' } }, h('div', {}, h('h1', { style: { margin: 0 } }, data.student.name), h('div', { class: 'muted' }, data.student.email)), h('div', { class: 'row' }, toneBadge(data.student.todayTone), data.level && h('span', { class: 'badge info' }, `${data.level.cefr} · IELTS ${data.level.ielts}`))),
    tabsEl, body);
}

let catalogCache = null;
async function catalog() { return (catalogCache ||= await api.get('/api/teacher/catalog')); }

function taskForm(id, refresh) {
  const root = h('div', {});
  (async () => {
    const cat = await catalog();
    const kind = sel([['grammar', '📘 Grammatika (mavzu takrori)'], ['vocab', "🔤 Lug'at (mavzu)"], ['reading', '📖 Reading'], ['listening', '🎧 Listening'], ['speaking', '🎤 Speaking'], ['writing', '✍️ Writing'], ['custom', '📌 O\'z topshirig\'im']], 'grammar');
    const unit = sel(cat.units.map((u) => [u.id, `${u.title} (${u.level})`]), cat.units[0].id);
    const topic = sel(cat.topics.map((t) => [t.id, t.title]), cat.topics[0].id);
    const level = sel(cat.levels.map((l) => [l, l]), 'B1');
    const free = h('input', { type: 'text', placeholder: 'Mavzu (ixtiyoriy), masalan: environment' });
    const title = h('input', { type: 'text', placeholder: 'Sarlavha' });
    const instr = h('textarea', { placeholder: "Ko'rsatma (o'quvchi shu matnni ko'radi)…", style: { minHeight: '90px' } });
    const mode = sel([['write', 'Yozma javob (AI baholaydi)'], ['speak', 'Og\'zaki javob (AI baholaydi)'], ['confirm', 'Faqat hisobot / tasdiqlash']], 'write');
    const date = h('input', { type: 'date', value: localDate() }), mins = h('input', { type: 'number', min: 10, max: 180, placeholder: 'Daqiqa (avto)' });
    const note = h('input', { type: 'text', placeholder: "O'quvchiga izoh (ixtiyoriy)" });
    const groups = { grammar: [field('Mavzu', unit)], vocab: [field('IELTS mavzu', topic)], reading: [field('Daraja', level), field('Mavzu', free)], listening: [field('Daraja', level), field('Mavzu', free)], speaking: [field('Daraja', level), field('Mavzu', free)], writing: [field('Daraja', level), field('Mavzu', free)], custom: [field('Sarlavha', title), field('Ko\'rsatma', instr), field('Javob turi', mode)] };
    const dyn = h('div', { class: 'grid g2' });
    const upd = () => dyn.replaceChildren(...groups[kind.value]); kind.onchange = upd; upd();
    root.append(h('div', { class: 'grid g3' }, field('Turi', kind), field('Sana', date), field('Daqiqa', mins)), dyn, field('Izoh', note),
      h('button', { class: 'btn', onclick: async (e) => {
        e.target.disabled = true;
        try { await api.post(`/api/teacher/students/${id}/tasks`, { kind: kind.value, unit: unit.value, topic: kind.value === 'vocab' ? topic.value : free.value, level: level.value, title: title.value, instructions: instr.value, mode: mode.value, date: date.value, minutes: Number(mins.value) || undefined, note: note.value }); toast('Topshiriq qo\'shildi ✓'); refresh(); }
        catch (er) { toast(er.message, true); }
        e.target.disabled = false;
      } }, 'Topshiriq berish'));
  })();
  return root;
}

function remedialForm(id, refresh) {
  const root = h('div', { class: 'row' });
  catalog().then((cat) => {
    const unit = sel(cat.units.map((u) => [u.id, u.title]), cat.units[0].id);
    root.append(unit, h('button', { class: 'btn', onclick: async () => { await api.post(`/api/teacher/students/${id}/remedial`, { unit: unit.value }); toast('3 ta takrorlash qo\'shildi ✓'); refresh(); } }, 'Qo\'shish'));
  });
  return root;
}

function uploadForm(studentId, refresh) {
  const file = h('input', { type: 'file', accept: '.pdf,.epub,.txt,.doc,.docx,.pptx,.xlsx,.mp3,.wav,.m4a,.mp4,.png,.jpg,.jpeg' });
  const title = h('input', { type: 'text', placeholder: 'Sarlavha (masalan: Murphy — Unit 1–10)' });
  const desc = h('input', { type: 'text', placeholder: 'Qisqa tavsif (ixtiyoriy)' });
  return h('div', {}, h('div', { class: 'grid g2' }, field('Fayl (maks. 25 MB)', file), field('Sarlavha', title)), field('Tavsif', desc),
    studentId ? h('small', { class: 'muted' }, 'Fayl faqat shu o\'quvchiga ko\'rinadi.') : h('small', { class: 'muted' }, 'Fayl barcha o\'quvchilaringizga ko\'rinadi.'),
    h('div', { style: { marginTop: '8px' } }, h('button', { class: 'btn', onclick: async (e) => {
      const f = file.files[0]; if (!f) return toast('Fayl tanlang', true);
      if (f.size > 25 * 1024 * 1024) return toast('Fayl 25 MB dan katta', true);
      e.target.disabled = true; e.target.replaceChildren(h('span', { class: 'spinner' }), ' Yuklanmoqda…');
      try { await api.upload(`/api/teacher/materials?title=${encodeURIComponent(title.value || f.name)}&description=${encodeURIComponent(desc.value)}${studentId ? '&studentId=' + studentId : ''}`, f); toast('Yuklandi ✓'); refresh(); }
      catch (er) { toast(er.message, true); }
      e.target.disabled = false; e.target.textContent = 'Yuklash';
    } }, 'Yuklash')));
}
function materialList(list, refresh) {
  if (!list.length) return h('p', { class: 'muted' }, 'Hali material yo\'q.');
  return list.map((m) => h('div', { class: 'row between q' }, h('div', {}, h('b', {}, m.title), h('div', { class: 'muted' }, `${m.filename} · ${(m.size / 1024).toFixed(0)} KB · ${m.forAll ? 'barcha o\'quvchilar' : 'shaxsiy'}`), m.description && h('div', {}, m.description)),
    h('div', { class: 'row' }, h('a', { class: 'btn secondary sm', href: `/api/materials/${m.id}/download` }, '⬇'), h('button', { class: 'btn ghost sm', onclick: async () => { if (!confirm('O\'chirilsinmi?')) return; await api.del('/api/teacher/materials/' + m.id); refresh(); } }, '🗑'))));
}

export async function teacherMaterialsView() {
  const box = h('div', { class: 'card' });
  const load = async () => { const list = await api.get('/api/teacher/materials'); mount(box, h('h2', {}, 'Barcha materiallarim'), materialList(list, load)); };
  await load();
  const vbox = h('div', { class: 'card' });
  const loadVocab = async () => {
    const v = await api.get('/api/teacher/vocab');
    const btn = (label, body) => h('button', { class: 'btn secondary sm', disabled: !v.ai, title: v.ai ? '' : 'Gemini API kaliti kerak', onclick: async (e) => {
      e.target.disabled = true; e.target.replaceChildren(h('span', { class: 'spinner' }), ' AI…');
      try { await api.post('/api/teacher/vocab/generate', body); toast('+40 ta so\'z qo\'shildi ✓'); loadVocab(); } catch (er) { toast(er.message, true); e.target.disabled = false; e.target.textContent = label; }
    } }, label);
    mount(vbox, h('h2', {}, "Lug'at bazasi"), h('p', { class: 'muted' }, `Kuniga ${52} ta yangi so'z uchun baza yetarli bo'lishi kerak. Har bosishda Gemini 40 ta yangi so'z yaratadi va saqlaydi.${v.ai ? '' : " Hozir AI ulanmagan."}`),
      h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['IELTS mavzusi', 'Daraja', "So'zlar", ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, v.topics.map((t) => h('tr', {}, h('td', {}, t.title), h('td', {}, t.level), h('td', {}, String(t.words)), h('td', {}, btn('+40 so\'z', { topic: t.id })))),
          v.general.map((g) => h('tr', {}, h('td', {}, 'Kundalik so\'zlar'), h('td', {}, g.level), h('td', {}, String(g.words)), h('td', {}, btn('+40 so\'z', { level: g.level })))))));
  };
  await loadVocab();
  return h('div', {}, h('h1', {}, 'Materiallar va lug\'at'), h('div', { class: 'card' }, h('h2', {}, 'Barcha o\'quvchilar uchun yuklash'), h('p', { class: 'muted' }, "Kitoblar, PDF, audio va boshqa o'quv materiallari. Muayyan o'quvchiga yuklash uchun uning sahifasidagi «Materiallar» bo'limidan foydalaning."), uploadForm(null, load)), box, vbox);
}
