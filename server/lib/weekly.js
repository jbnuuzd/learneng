// Weekly report for a teacher: last 7 days per student (grouped queries, independent of class size).
import { q } from './db.js';
import { addDays } from './dates.js';
import { generateText, aiEnabled, aiErrorText } from './gemini.js';

export async function weeklyReport(teacherId, date) {
  const from = addDays(date, -6);
  const IDS = "(SELECT id FROM users WHERE role='student' AND teacher_id=?)";
  const [students, tasks, words, scores, speaking, days, prev] = await Promise.all([
    q.all("SELECT id,name FROM users WHERE role='student' AND teacher_id=? ORDER BY name", teacherId),
    q.all(`SELECT user_id, COUNT(*) planned, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, COALESCE(SUM(CASE WHEN status='done' THEN minutes END),0) minutes FROM tasks WHERE date>=? AND date<=? AND user_id IN ${IDS} GROUP BY user_id`, from, date, teacherId),
    q.all(`SELECT user_id, COUNT(*) n FROM learned_words WHERE learned_on>=? AND learned_on<=? AND user_id IN ${IDS} GROUP BY user_id`, from, date, teacherId),
    q.all(`SELECT user_id, skill, AVG(score) a FROM attempts WHERE score IS NOT NULL AND substr(created_at,1,10)>=? AND user_id IN ${IDS} GROUP BY user_id, skill`, from, teacherId),
    q.all(`SELECT user_id, COUNT(*) n FROM speaking_sessions WHERE status='done' AND substr(created_at,1,10)>=? AND user_id IN ${IDS} GROUP BY user_id`, from, teacherId),
    q.all(`SELECT user_id, COUNT(DISTINCT date) n FROM tasks WHERE status='done' AND date>=? AND date<=? AND user_id IN ${IDS} GROUP BY user_id`, from, date, teacherId),
    q.all(`SELECT user_id, COALESCE(SUM(CASE WHEN status='done' THEN minutes END),0) minutes FROM tasks WHERE date>=? AND date<? AND user_id IN ${IDS} GROUP BY user_id`, addDays(date, -13), from, teacherId),
  ]);
  const one = (rows) => new Map(rows.map((r) => [r.user_id, r]));
  const T = one(tasks), W = one(words), S = one(speaking), D = one(days), P = one(prev);
  const sc = new Map(); for (const r of scores) { if (!sc.has(r.user_id)) sc.set(r.user_id, {}); sc.get(r.user_id)[r.skill] = Math.round(r.a * 100); }
  const rows = students.map((s) => {
    const t = T.get(s.id), planned = t?.planned || 0, done = t?.done || 0, minutes = t?.minutes || 0, prevMin = P.get(s.id)?.minutes || 0;
    const skills = sc.get(s.id) || {}, vals = Object.values(skills);
    const flags = [];
    if (planned && done / planned < 0.5) flags.push('behind');
    if (!(D.get(s.id)?.n)) flags.push('inactive');
    if (prevMin >= 60 && minutes < prevMin * 0.6) flags.push('dropping');
    if (minutes > prevMin * 1.3 && minutes >= 60) flags.push('improving');
    return { id: s.id, name: s.name, planned, done, completion: planned ? Math.round((done / planned) * 100) : null, minutes, prevMinutes: prevMin,
      activeDays: D.get(s.id)?.n || 0, newWords: W.get(s.id)?.n || 0, speaking: S.get(s.id)?.n || 0, avgScore: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null, skills, flags };
  });
  const rank = (r) => (r.flags.includes('inactive') ? 0 : r.flags.includes('behind') ? 1 : r.flags.includes('dropping') ? 2 : 3);
  rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
  return { from, to: date, totals: { students: rows.length, minutes: tot('minutes'), tasksDone: tot('done'), newWords: tot('newWords'), speaking: tot('speaking'), attention: rows.filter((r) => r.flags.some((f) => f === 'inactive' || f === 'behind' || f === 'dropping')).length }, students: rows };
}

export async function weeklySummary(report) {
  if (!aiEnabled()) return { ai: false, text: null };
  const lines = report.students.map((r) => `${r.name}: ${r.done}/${r.planned} topshiriq, ${r.minutes} daq (oldingi hafta ${r.prevMinutes}), ${r.activeDays} faol kun, ${r.newWords} yangi so'z, o'rtacha ball ${r.avgScore ?? '—'}, belgilar: ${r.flags.join(',') || '—'}`).join('\n');
  try {
    const text = await generateText(`Siz tajribali ingliz tili metodistisiz. O'qituvchi uchun oxirgi 7 kunlik hisobotni 5–8 qisqa jumlada o'zbek tilida (lotin) xulosa qiling: kim yaxshi ketyapti, kimga e'tibor kerak va nima qilish mumkin (aniq, ismlar bilan). Faqat quyidagi ma'lumotlarga tayaning, o'ylab topmang.\n<source_text>\n${lines}\n</source_text>`, { temperature: 0.3, timeout: 45000, fast: true });
    return { ai: true, text };
  } catch (e) { return { ai: false, text: null, error: aiErrorText(e) }; }
}
