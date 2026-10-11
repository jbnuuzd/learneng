import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { addDays, addMonths, diffDays, isDate } from '../lib/dates.js';
import { abilities, overall, history, currentLevel, SKILLS, SKILL_UZ } from '../lib/progress.js';
import { toCefr, toIelts, ieltsToAbility, cefrToAbility, describe, LEVELS, goalAbility } from '../lib/scale.js';
import { previewGoal, generatePlan, activePlan, weakTopics, NEW_WORDS_PER_DAY, VOCAB_MINUTES } from '../planner.js';
import { describeTask, hydrate, TYPE_UZ } from '../lessons.js';
import { badgesFor } from '../lib/badges.js';
import { analyseGoal } from '../analysis.js';
import { ensureSrsTask, srsStats } from '../lib/srs.js';
import { unitById } from '../lib/content.js';

export function resolveTarget(body) {
  let cefr = LEVELS.includes(body.targetCefr) ? body.targetCefr : null;
  let ielts = Number(body.targetIelts);
  ielts = Number.isFinite(ielts) && ielts >= 1 && ielts <= 9 ? Math.round(ielts * 2) / 2 : null;
  if (!cefr && ielts == null) throw bad('Maqsad darajasini tanlang (CEFR yoki IELTS)');
  if (ielts == null) ielts = toIelts(cefrToAbility(cefr));
  if (!cefr) cefr = toCefr(ieltsToAbility(ielts));
  return { cefr, ielts };
}
export function resolveDeadline(body, start) {
  let deadline;
  if (isDate(body.deadline)) deadline = body.deadline;
  else if (Number(body.months) > 0) deadline = addMonths(start, Math.min(36, Math.round(Number(body.months))));
  else if (Number(body.weeks) > 0) deadline = addDays(start, Math.min(156, Math.round(Number(body.weeks))) * 7);
  else throw bad('Imtihongacha qancha vaqt borligini kiriting');
  const days = diffDays(start, deadline);
  if (days < 7) throw bad("Muddat kamida 1 hafta bo'lsin");
  if (days > 800) throw bad("Muddat 2 yildan oshmasin");
  return deadline;
}

export async function dayView(userId, date) {
  const rows = await q.all('SELECT t.*, u.name AS by_name FROM tasks t LEFT JOIN users u ON u.id=t.assigned_by WHERE t.user_id=? AND t.date=? ORDER BY t.ord, t.id', userId, date);
  const counts = Object.fromEntries((await q.all('SELECT task_id, COUNT(DISTINCT stage_key) n FROM attempts WHERE task_id IN (SELECT id FROM tasks WHERE user_id=? AND date=?) GROUP BY task_id', userId, date)).map((r) => [r.task_id, r.n]));
  const tasks = rows.map((row) => {
    const t = hydrate(row);
    const info = describeTask(t);
    return { id: t.id, type: t.type, typeName: TYPE_UZ[t.type] || t.type, ...info, minutes: t.minutes, status: t.status, score: t.score, source: t.source, note: t.note, by: t.by_name || null, stagesDone: counts[t.id] || 0 };
  });
  const total = tasks.reduce((s, t) => s + t.minutes, 0);
  const done = tasks.filter((t) => t.status === 'done').reduce((s, t) => s + t.minutes, 0);
  return { date, tasks, totalMinutes: total, doneMinutes: done, percent: total ? Math.round((done / total) * 100) : 0, newWords: tasks.some((t) => t.type === 'vocab') ? NEW_WORDS_PER_DAY : 0 };
}

export async function statsFor(userId, today) {
  const wordsLearned = (await q.get('SELECT COUNT(*) n FROM learned_words WHERE user_id=?', userId)).n;
  const tasksDone = await q.get("SELECT COUNT(*) n, COALESCE(SUM(minutes),0) m FROM tasks WHERE user_id=? AND status='done'", userId);
  const doneDays = new Set((await q.all("SELECT DISTINCT date FROM tasks WHERE user_id=? AND status='done'", userId)).map((r) => r.date));
  let streak = 0, d = doneDays.has(today) ? today : addDays(today, -1);
  while (doneDays.has(d)) { streak++; d = addDays(d, -1); }
  const missed = (await q.get("SELECT COUNT(*) n FROM tasks WHERE user_id=? AND date<? AND status!='done'", userId, today)).n;
  const planned = (await q.get("SELECT COUNT(*) n FROM tasks WHERE user_id=? AND date<?", userId, today)).n;
  return { wordsLearned, tasksDone: tasksDone.n, minutesDone: tasksDone.m, streak, missed, completionRate: planned ? Math.round(((planned - missed) / planned) * 100) : null };
}

export async function progressFor(userId, today) {
  const ab = await abilities(userId);
  const o = overall(ab);
  const recent = await q.all('SELECT id, task_id, stage_key, stage_type, skill, topic, score, feedback, tone, ai, created_at FROM attempts WHERE user_id=? ORDER BY id DESC LIMIT 15', userId);
  const stats = await statsFor(userId, today);
  return {
    badges: await badgesFor(userId, stats),
    overall: o == null ? null : describe(o),
    skills: SKILLS.map((s) => ({ skill: s, name: SKILL_UZ[s], ...(ab[s] != null ? describe(ab[s]) : { ability: null }) })),
    srs: await srsStats(userId, today), history: await history(userId), stats, weakTopics: (await weakTopics(userId)).map((id) => ({ id, title: unitById[id]?.title || id })), recent,
  };
}

export function registerPlan(r) {
  // Messages from the student's teacher (unread first)
  r.get('/api/messages', async ({ user }) => q.all('SELECT m.id, m.text, m.read, m.created_at, u.name AS teacher FROM messages m JOIN users u ON u.id=m.teacher_id WHERE m.student_id=? ORDER BY m.read, m.id DESC LIMIT 10', user.id), { role: 'student' });
  r.post('/api/messages/read', async ({ user }) => { await q.run('UPDATE messages SET read=1 WHERE student_id=? AND read=0', user.id); return { ok: true }; }, { role: 'student' });

  r.post('/api/goal/preview', async ({ user, body, date }) => {
    const ov = overall(await abilities(user.id));
    if (ov == null) throw bad('Avval diagnostik testni topshiring');
    const t = resolveTarget(body);
    const start = date, deadline = resolveDeadline(body, start);
    const pv = previewGoal({ current: ov, target: goalAbility({ target_cefr: t.cefr, target_ielts: t.ielts }), start, deadline });
    return { current: describe(ov), target: t, start, deadline, ...pv, newWordsPerDay: NEW_WORDS_PER_DAY, vocabMinutes: VOCAB_MINUTES };
  }, { role: 'student' });

  r.post('/api/goal', async ({ user, body, date }) => {
    const ov = overall(await abilities(user.id));
    if (ov == null) throw bad('Avval diagnostik testni topshiring');
    const t = resolveTarget(body);
    const start = date, deadline = resolveDeadline(body, start);
    const pv = previewGoal({ current: ov, target: goalAbility({ target_cefr: t.cefr, target_ielts: t.ielts }), start, deadline });
    const hrs = Math.min(10, Math.max(1.5, Number(body.hoursPerDay) || pv.recommendedHoursPerDay));
    await q.run('INSERT INTO goals(user_id,target_cefr,target_ielts,start_date,deadline,hours_per_day) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET target_cefr=excluded.target_cefr, target_ielts=excluded.target_ielts, start_date=excluded.start_date, deadline=excluded.deadline, hours_per_day=excluded.hours_per_day',
      user.id, t.cefr, t.ielts, start, deadline, hrs);
    const goal = await q.get('SELECT * FROM goals WHERE user_id=?', user.id);
    const plan = await generatePlan({ userId: user.id, goal, from: start });
    return { goal, preview: pv, plan: { id: plan.planId, tasks: plan.tasks } };
  }, { role: 'student' });

  r.get('/api/plan', async ({ user, date }) => {
    const goal = await q.get('SELECT * FROM goals WHERE user_id=?', user.id);
    const plan = await activePlan(user.id);
    if (plan) await ensureSrsTask(user.id, date);
    return { goal, plan: plan && { id: plan.id, ...plan.meta }, today: date, stats: await statsFor(user.id, date), todayView: plan ? await dayView(user.id, date) : null };
  }, { role: 'student' });

  r.get('/api/plan/day', async ({ user, query, date }) => {
    const d = isDate(query.date) ? query.date : date;
    if (d === date) await ensureSrsTask(user.id, d);
    return dayView(user.id, d);
  }, { role: 'student' });

  r.get('/api/plan/calendar', async ({ user, query, date }) => {
    const from = isDate(query.from) ? query.from : date;
    const to = isDate(query.to) ? query.to : addDays(from, 42);
    if (diffDays(from, to) > 400) throw bad('Oraliq juda uzun');
    const rows = await q.all("SELECT date, COUNT(*) n, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(minutes) minutes, SUM(CASE WHEN status='done' THEN minutes ELSE 0 END) doneMinutes, SUM(CASE WHEN source!='plan' THEN 1 ELSE 0 END) extra FROM tasks WHERE user_id=? AND date>=? AND date<=? GROUP BY date ORDER BY date", user.id, from, to);
    return { from, to, days: rows };
  }, { role: 'student' });

  r.post('/api/plan/regenerate', async ({ user, date }) => {
    const goal = await q.get('SELECT * FROM goals WHERE user_id=?', user.id);
    if (!goal) throw bad('Maqsad belgilanmagan');
    const out = await generatePlan({ userId: user.id, goal, from: date });
    return { ok: true, tasks: out.tasks };
  }, { role: 'student' });

  r.get('/api/progress', async ({ user, date }) => progressFor(user.id, date), { role: 'student' });
  r.get('/api/analysis', async ({ user, date }) => analyseGoal(user.id, date), { role: 'student' });
}
