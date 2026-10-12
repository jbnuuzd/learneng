// Bulk teacher dashboard data: ~12 grouped queries regardless of class size (Workers limits subrequests per request).
import { q } from './db.js';
import { addDays, diffDays } from './dates.js';
import { overall, SKILLS } from './progress.js';
import { describe } from './scale.js';
import { unitById } from './content.js';
import { isTone } from './ai.js';

// Pure alert rules, shared with the single-student view.
export function buildAlerts({ today, planned7, missed7, last, low }) {
  const out = [];
  if (planned7 >= 3 && missed7 / planned7 >= 0.4) out.push({ level: 'danger', code: 'behind', text: `Oxirgi 7 kunda ${missed7}/${planned7} topshiriq bajarilmagan — grafikdan orqada.` });
  if (!last) out.push({ level: 'warn', code: 'inactive', text: 'Hali birorta mashq bajarmagan.' });
  else if (diffDays(last.slice(0, 10), today) >= 3) out.push({ level: 'warn', code: 'inactive', text: `${diffDays(last.slice(0, 10), today)} kundan beri faol emas.` });
  for (const l of low) out.push({ level: 'warn', code: 'weak-topic', unit: l.topic, text: `«${unitById[l.topic]?.title || l.topic}» mavzusida o'rtacha natija ${Math.round(l.a * 100)}%.` });
  return out;
}

export async function studentsOverview(teacherId, date) {
  const students = await q.all("SELECT id,name,email,feedback_tone FROM users WHERE role='student' AND teacher_id=? ORDER BY name", teacherId);
  if (!students.length) return [];
  const IDS = "(SELECT id FROM users WHERE role='student' AND teacher_id=?)";
  const from7 = addDays(date, -7), from90 = addDays(date, -90);
  const [ab, goals, overrides, today, words, doneAgg, doneDates, past, week, lastAtt, low, ownKeys] = await Promise.all([
    q.all(`SELECT user_id, skill, ability FROM skill_progress WHERE user_id IN ${IDS}`, teacherId),
    q.all(`SELECT user_id, target_cefr, target_ielts, deadline FROM goals WHERE user_id IN ${IDS}`, teacherId),
    q.all(`SELECT student_id, tone FROM tone_overrides WHERE date=? AND student_id IN ${IDS}`, date, teacherId),
    q.all(`SELECT user_id, SUM(minutes) total, SUM(CASE WHEN status='done' THEN minutes ELSE 0 END) done FROM tasks WHERE date=? AND user_id IN ${IDS} GROUP BY user_id`, date, teacherId),
    q.all(`SELECT user_id, COUNT(*) n FROM learned_words WHERE user_id IN ${IDS} GROUP BY user_id`, teacherId),
    q.all(`SELECT user_id, COUNT(*) n, COALESCE(SUM(minutes),0) m FROM tasks WHERE status='done' AND user_id IN ${IDS} GROUP BY user_id`, teacherId),
    q.all(`SELECT DISTINCT user_id, date FROM tasks WHERE status='done' AND date>=? AND user_id IN ${IDS}`, from90, teacherId),
    q.all(`SELECT user_id, COUNT(*) planned, SUM(CASE WHEN status!='done' THEN 1 ELSE 0 END) missed FROM tasks WHERE date<? AND user_id IN ${IDS} GROUP BY user_id`, date, teacherId),
    q.all(`SELECT user_id, COUNT(*) planned, SUM(CASE WHEN status!='done' THEN 1 ELSE 0 END) missed FROM tasks WHERE date<? AND date>=? AND user_id IN ${IDS} GROUP BY user_id`, date, from7, teacherId),
    q.all(`SELECT user_id, MAX(created_at) t FROM attempts WHERE user_id IN ${IDS} GROUP BY user_id`, teacherId),
    q.all(`SELECT user_id, topic, AVG(score) a, COUNT(*) n FROM attempts WHERE skill='grammar' AND score IS NOT NULL AND topic IS NOT NULL AND created_at>=datetime('now','-14 day') AND user_id IN ${IDS} GROUP BY user_id, topic HAVING n>=2 AND a<0.6`, teacherId),
    q.all(`SELECT DISTINCT user_id FROM student_keys WHERE user_id IN ${IDS}`, teacherId),
  ]);
  const ownSet = new Set(ownKeys.map((r) => r.user_id));
  const by = (rows, key = 'user_id') => { const m = new Map(); for (const r of rows) { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r); } return m; };
  const abBy = by(ab), goalBy = new Map(goals.map((g) => [g.user_id, g])), ovBy = new Map(overrides.map((o) => [o.student_id, o.tone]));
  const todayBy = new Map(today.map((t) => [t.user_id, t])), wordsBy = new Map(words.map((w) => [w.user_id, w.n])), doneBy = new Map(doneAgg.map((d) => [d.user_id, d]));
  const datesBy = by(doneDates), pastBy = new Map(past.map((p) => [p.user_id, p])), weekBy = new Map(week.map((p) => [p.user_id, p])), lastBy = new Map(lastAtt.map((l) => [l.user_id, l.t])), lowBy = by(low);
  return students.map((s) => {
    const abil = Object.fromEntries((abBy.get(s.id) || []).map((r) => [r.skill, r.ability]));
    const o = overall(abil);
    const t = todayBy.get(s.id), total = t?.total || 0, done = t?.done || 0;
    const days = new Set((datesBy.get(s.id) || []).map((r) => r.date));
    let streak = 0, d = days.has(date) ? date : addDays(date, -1);
    while (days.has(d)) { streak++; d = addDays(d, -1); }
    const p = pastBy.get(s.id), wk = weekBy.get(s.id), dn = doneBy.get(s.id);
    const planned = p?.planned || 0, missed = p?.missed || 0;
    const tone = ovBy.get(s.id) || (isTone(s.feedback_tone) ? s.feedback_tone : 'neutral');
    const g = goalBy.get(s.id);
    return {
      id: s.id, name: s.name, email: s.email, level: o == null ? null : describe(o),
      goal: g ? { target_cefr: g.target_cefr, target_ielts: g.target_ielts, deadline: g.deadline } : undefined, tone,
      today: { percent: total ? Math.round((done / total) * 100) : 0, minutes: total },
      alerts: buildAlerts({ today: date, planned7: wk?.planned || 0, missed7: wk?.missed || 0, last: lastBy.get(s.id) || null, low: lowBy.get(s.id) || [] }),
      stats: { wordsLearned: wordsBy.get(s.id) || 0, tasksDone: dn?.n || 0, minutesDone: dn?.m || 0, streak, missed, completionRate: planned ? Math.round(((planned - missed) / planned) * 100) : null },
      lastActive: lastBy.get(s.id) || null, ownKey: ownSet.has(s.id),
    };
  });
}
