import { api } from '../api.js';
import { h, bar, lineChart, COLORS, SKILL_NAME, CEFR_Y, levelCard, skillBars, mount, loading, toast, fmtDate, fmtMin } from '../ui.js';
import { bullets } from '../components.js';

export function historyChart(history) {
  const series = Object.entries(history).map(([k, pts]) => ({ name: SKILL_NAME[k] || k, color: COLORS[k] || '#888', points: pts.map((p) => ({ x: p.date, y: p.ability })) })).filter((s) => s.points.length);
  if (!series.length) return h('p', { class: 'muted' }, 'Hali ma\'lumot yo\'q.');
  return h('div', {}, lineChart(series, { yLabels: CEFR_Y }), h('div', { class: 'legend' }, series.map((s) => h('span', {}, h('i', { style: { background: s.color } }), s.name))));
}

export function analysisView(a) {
  if (!a.ready) return h('div', { class: 'alert' }, a.reason);
  const n = a.narrative;
  const vcls = { realistic: 'ok', stretch: 'warn', unrealistic: 'bad' }[a.verdict];
  const vtxt = { realistic: 'Real maqsad', stretch: 'Qiyin, lekin mumkin', unrealistic: 'Hozirgi reja bilan real emas' }[a.verdict];
  return h('div', {},
    h('div', { class: 'alert ' + vcls }, h('div', { class: 'row between' }, h('b', {}, `${vtxt} · erishish ehtimoli ≈ ${a.chance}%`), h('span', { class: 'badge ' + (n.ai ? 'ok' : 'warn') }, n.ai ? '🤖 Gemini tahlili' : 'Hisoblangan tahlil')), h('p', { style: { margin: '8px 0 0' } }, n.summary)),
    h('div', { class: 'grid g4' },
      levelCard('Hozir', a.current), levelCard('Reja bo\'yicha kutilayotgan', a.predicted), levelCard('Maqsad', { cefr: a.target.cefr, ielts: a.target.ielts }),
      h('div', { class: 'card flat stat' }, h('b', {}, `${a.adherence}%`), h('span', {}, 'bajarish darajasi'))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card flat' }, h('h3', {}, '⏱ Vaqt'), h('table', { class: 't' }, h('tbody', {},
        [['Maqsad uchun kerak (taxmin)', `${a.hours.required} soat`], ['Reja bo\'yicha qolgan', `${a.hours.futurePlanned} soat`], ['Bajarish darajasini hisobga olgan holda', `${a.hours.futureEffective} soat`], ['Kunlik yuklama', `${a.hours.perDay} soat`], ['Kerakli kunlik yuklama', a.hours.neededPerDay ? `${a.hours.neededPerDay} soat` : '—'], ['Yetishmayotgan', `${a.hours.shortfall} soat`]].map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, h('b', {}, v))))))),
      h('div', { class: 'card flat' }, h('h3', {}, "🔤 Lug'at"), h('table', { class: 't' }, h('tbody', {},
        [['Kunlik yangi so\'z', `${a.vocabulary.newWordsPerDay} ta ${a.vocabulary.meetsDailyTarget ? '✅' : '⚠️'}`], ['Hozirgacha o\'rganilgan', `${a.vocabulary.learnedSoFar} ta`], ['Rejadagi yangi so\'zlar', `${a.vocabulary.plannedNew} ta`], [`Eslab qolish (${a.vocabulary.retentionMeasured ? 'sizning haqiqiy natijangiz' : 'taxminiy'}: ${Math.round(a.vocabulary.retention * 100)}%) hisobida`, `~${a.vocabulary.projected} ta faol lug'at`], ['Maqsad uchun taxminiy lug\'at', `~${a.vocabulary.target} ta`], ['Qoplanish', `${a.vocabulary.coverage}%`]].map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, h('b', {}, v))))))),
      h('div', { class: 'card flat' }, h('h3', {}, '📘 Grammatika'), h('p', {}, `Maqsad uchun ${a.grammar.unitsNeeded} ta mavzu kerak, rejada/bajarilgan: ${a.grammar.unitsCovered} (${a.grammar.coverage}%).`), a.grammar.contentCeiling && h('small', { class: 'muted' }, 'Tayyor darslar C1 gacha; undan yuqori uchun AI kontent kerak.')),
      h('div', { class: 'card flat' }, h('h3', {}, "🎯 Ko'nikmalar bo'yicha tafovut"), skillBars(a.skills.map((s) => ({ ...s.current, name: s.name, ability: s.current?.ability, cefr: s.current?.cefr, ielts: s.current?.ielts }))))),
    bullets('⚠️ Xavflar', n.risks), bullets('✅ Tavsiya etilgan harakatlar', n.actions),
    n.skillPriorities?.length ? h('div', {}, h('b', {}, '🧭 Ustuvorliklar'), h('ul', {}, n.skillPriorities.map((p) => h('li', {}, h('b', {}, SKILL_NAME[p.skill] || p.skill), `: ${p.why}${p.minutesPerDay ? ` (kuniga ~${p.minutesPerDay} daq.)` : ''}`)))) : null,
    a.suggestedDeadline && h('div', { class: 'alert' }, `Agar hozirgi tempda davom etsangiz, maqsadga taxminan ${fmtDate(a.suggestedDeadline)} da yetish mumkin.`),
    h('small', { class: 'muted' }, a.disclaimer));
}

export async function progressView() {
  const p = await api.get('/api/progress');
  const pron = await api.get('/api/trainers/pronunciation/stats').catch(() => ({ total: 0 }));
  const anaBox = h('div', {});
  const btn = h('button', { class: 'btn lg', onclick: async () => {
    btn.disabled = true; mount(anaBox, loading('AI tahlil qilmoqda…'));
    try { mount(anaBox, analysisView(await api.get('/api/analysis'))); } catch (e) { mount(anaBox, h('div', { class: 'alert bad' }, e.message)); }
    btn.disabled = false; btn.textContent = '↻ Qayta tahlil qilish';
  } }, '🔍 Maqsadga erishish imkoniyatini tahlil qilish');
  const st = p.stats;
  return h('div', {},
    h('h1', {}, 'Progress va tahlil'),
    h('div', { class: 'grid g4' }, levelCard('Umumiy daraja', p.overall), h('div', { class: 'card flat stat' }, h('b', {}, st.tasksDone), h('span', {}, 'bajarilgan topshiriq')), h('div', { class: 'card flat stat' }, h('b', {}, fmtMin(st.minutesDone)), h('span', {}, 'jami o\'qilgan')), h('div', { class: 'card flat stat' }, h('b', {}, st.completionRate != null ? st.completionRate + '%' : '—'), h('span', {}, 'reja bajarilishi'))),
    pron.total ? h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', {}, '🗣 Talaffuz'), h('a', { class: 'btn secondary sm', href: '#/trainer/pronunciation' }, 'Mashq qilish')),
      h('div', { class: 'grid g4' }, [[pron.recentAvg + '%', "oxirgi 10 ta o'rtacha"], [pron.best + '%', 'eng yaxshi'], [pron.total, 'tekshirilgan gap'], [pron.trend == null ? '—' : (pron.trend >= 0 ? '▲ +' : '▼ ') + pron.trend, "o'zgarish (oldingi 10 taga nisbatan)"]].map(([b, s]) => h('div', { class: 'card flat stat' }, h('b', {}, b), h('span', {}, s)))),
      h('div', {}, pron.groups.map((g) => h('div', { class: 'row between q' }, h('span', {}, g.title), h('div', { style: { width: '50%' } }, bar(g.avg / 100, g.avg >= 75 ? 'ok' : '')), h('b', {}, g.avg + '%')))),
      pron.weakest?.length ? h('div', { class: 'alert warn' }, '💡 Eng ko\'proq mashq kerak: ' + pron.weakest.map((g) => g.title).join(', ')) : null) : null,
    p.badges?.length ? h('div', { class: 'card' }, h('h2', {}, '🏅 Yutuqlar'), h('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } }, p.badges.map((b) => h('span', { class: 'badge ' + (b.earned ? 'ok' : ''), title: b.earned ? 'Qo\'lga kiritilgan' : `Keyingi maqsad: ${b.progress}%`, style: b.earned ? {} : { opacity: .55 } }, (b.earned ? '' : '🔒 ') + b.title + (b.earned ? '' : ` (${b.progress}%)`))))) : null,
    p.srs && p.srs.total ? h('div', { class: 'card' }, h('h2', {}, "🔁 So'z xotirasi"),
      h('div', { class: 'grid g4' }, [[p.srs.total, "o'rganilgan so'z"], [p.srs.due, 'bugun takrorlash kerak'], [p.srs.mastered, "mustahkam (14+ kun)"], [p.srs.accuracy != null ? p.srs.accuracy + '%' : '—', 'takrorlash aniqligi']].map(([v, t]) => h('div', { class: 'card flat stat' }, h('b', {}, v), h('span', {}, t)))),
      h('p', { class: 'muted' }, "Qutilar (1→3→7→14→30→60 kun): ", p.srs.boxes.map((n, i) => `${['1k', '3k', '7k', '14k', '30k', '60k'][i]}: ${n}`).join(' · '))) : null,
    h('div', { class: 'card' }, h('h2', {}, "Ko'nikmalar"), skillBars(p.skills.map((s) => ({ ...s })))),
    h('div', { class: 'card' }, h('h2', {}, "Rivojlanish dinamikasi"), historyChart(p.history)),
    p.weakTopics.length ? h('div', { class: 'card' }, h('h2', {}, 'Zaif mavzular'), h('p', { class: 'muted' }, 'Rejada takrorlash ustuvor:'), h('div', { class: 'row' }, p.weakTopics.map((t) => h('span', { class: 'badge warn' }, t.title)))) : null,
    h('div', { class: 'card' }, h('h2', {}, "Maqsadga erishish tahlili (sun'iy intellekt)"), h('p', { class: 'muted' }, "Reja, bajarilish darajasi, vaqt va lug'at hajmi asosida: bu mavzularni o'zlashtirib, ko'zlangan maqsadga haqiqatan erishish mumkinmi?"), btn, h('div', { style: { height: '12px' } }), anaBox),
    h('div', { class: 'card' }, h('h2', {}, 'Oxirgi fikr-mulohazalar'), p.recent.length ? p.recent.slice(0, 8).map((a) => h('div', { class: 'q' }, h('div', { class: 'row between' }, h('b', {}, `${SKILL_NAME[a.skill] || a.skill || ''} · ${a.stage_key}`), a.score != null && h('span', { class: 'badge' }, Math.round(a.score * 100) + '%')), h('div', { class: 'fb muted' }, (a.feedback || '').slice(0, 280)))) : h('p', { class: 'muted' }, 'Hali mashq bajarilmagan.')));
}
