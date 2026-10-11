import { api } from '../api.js';
import { h, fmtDate, fmtMin, bar, TYPE_ICON, toneBadge, levelCard, toast } from '../ui.js';
import { state, go } from '../state.js';

export function taskRow(t, { date } = {}) {
  return h('a', { class: 'task' + (t.status === 'done' ? ' done' : ''), href: '#/task/' + t.id },
    h('div', { class: 'ico' }, t.status === 'done' ? '✅' : TYPE_ICON[t.type] || '📌'),
    h('div', { class: 'grow' }, h('b', {}, t.title), h('div', { class: 'muted' }, `${t.typeName}${t.subtitle ? ' · ' + t.subtitle : ''}`),
      (t.source !== 'plan' || t.note) && h('div', {}, t.source !== 'plan' && h('span', { class: 'badge warn' }, t.source === 'remedial' ? 'Qo\'shimcha takrorlash' : `O'qituvchi${t.by ? ': ' + t.by : ''}`), t.note && h('small', { class: 'muted' }, ' ' + t.note))),
    h('div', { style: { textAlign: 'right' } }, h('div', {}, `≈ ${fmtMin(t.minutes)}`), t.status === 'partial' && h('span', { class: 'badge warn' }, `${t.stagesDone} bosqich`), t.status === 'done' && t.score != null && h('span', { class: 'badge ok' }, Math.round(t.score * 100) + '%')));
}

export async function homeView() {
  const [plan, prog, mats] = await Promise.all([api.get('/api/plan'), api.get('/api/progress'), api.get('/api/materials').catch(() => [])]);
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
      day && h('div', { class: 'progress' }, h('div', { class: 'row between' }, h('small', {}, "Bugungi reja"), h('small', {}, `${fmtMin(day.doneMinutes)} / ${fmtMin(day.totalMinutes)} · ${Math.round(day.percent)}%`)), bar(day.percent / 100))),
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
