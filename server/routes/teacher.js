import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { addDays, isDate, diffDays } from '../lib/dates.js';
import { abilities, overall, effectiveTone, history, SKILLS, SKILL_UZ } from '../lib/progress.js';
import { describe, LEVELS } from '../lib/scale.js';
import { TONES, isTone } from '../lib/ai.js';
import { unitById, units, topicCatalog, topicById, loadVocabCache, topicPoolFrom, generalPoolFrom, growTopic, growGeneral } from '../lib/content.js';
import { aiEnabled } from '../lib/gemini.js';
import { rateLimit, hashPassword } from '../lib/auth.js';
import { studentsOverview, buildAlerts } from '../lib/overview.js';
import { generatePlan, activePlan, weakTopics, VOCAB, VOCAB_MINUTES } from '../planner.js';
import { describeTask, hydrate, TYPE_UZ } from '../lessons.js';
import { analyseGoal } from '../analysis.js';
import { weeklyReport, weeklySummary } from '../lib/weekly.js';
import { dayView, statsFor, resolveTarget, resolveDeadline } from './plan.js';
import { previousAttempts } from './tasks.js';
import { sessionView } from './speaking.js';
import { listMaterialsFor } from './materials.js';

async function myStudent(teacher, id) {
  const s = await q.get("SELECT * FROM users WHERE id=? AND role='student'", Number(id));
  if (!s || s.teacher_id !== teacher.id) throw new HttpError(404, "O'quvchi topilmadi");
  return s;
}

export async function alertsFor(studentId, today) {
  const from7 = addDays(today, -7);
  const wk = await q.get("SELECT COUNT(*) planned, COALESCE(SUM(CASE WHEN status!='done' THEN 1 ELSE 0 END),0) missed FROM tasks WHERE user_id=? AND date<? AND date>=?", studentId, today, from7);
  const last = (await q.get('SELECT MAX(created_at) t FROM attempts WHERE user_id=?', studentId)).t;
  const low = await q.all("SELECT topic, AVG(score) a, COUNT(*) n FROM attempts WHERE user_id=? AND skill='grammar' AND score IS NOT NULL AND topic IS NOT NULL AND created_at>=datetime('now','-14 day') GROUP BY topic HAVING n>=2 AND a<0.6", studentId);
  return buildAlerts({ today, planned7: wk.planned, missed7: wk.missed, last, low });
}

async function addTask(studentId, teacherId, { type, ref, date, minutes, note, source = 'teacher' }) {
  const ord = ((await q.get('SELECT MAX(ord) m FROM tasks WHERE user_id=? AND date=?', studentId, date)).m ?? 0) + 1;
  const plan = await activePlan(studentId);
  const id = (await q.run('INSERT INTO tasks(plan_id,user_id,date,ord,type,ref_json,minutes,source,note,assigned_by) VALUES(?,?,?,?,?,?,?,?,?,?)',
    plan?.id ?? null, studentId, date, ord, type, j(ref), minutes, source, note || null, teacherId)).lastInsertRowid;
  return id;
}

function buildTaskSpec(body) {
  const kind = body.kind;
  const lvl = LEVELS.includes(body.level) ? body.level : 'B1';
  const topic = String(body.topic || '').trim().slice(0, 60) || 'education';
  switch (kind) {
    case 'grammar': {
      if (!unitById[body.unit]) throw bad('Grammatika mavzusini tanlang');
      return { type: 'grammar', ref: { unit: body.unit, mode: body.mode === 'new' ? 'new' : 'review' }, minutes: 45 };
    }
    case 'vocab': {
      const t = topicById[body.topic] ? body.topic : 'education';
      return { type: 'vocab', ref: { topic: t, level: topicById[t].level, ...VOCAB }, minutes: VOCAB_MINUTES };
    }
    case 'reading': return { type: 'reading', ref: { level: lvl, topic }, minutes: 30 };
    case 'listening': return { type: 'listening', ref: { level: lvl, topic }, minutes: 30 };
    case 'speaking': return { type: 'speaking', ref: { level: lvl, topic, n: 2 }, minutes: 20 };
    case 'writing': return { type: 'writing', ref: { level: lvl, topic }, minutes: 35 };
    case 'custom': {
      const title = String(body.title || '').trim().slice(0, 120), instructions = String(body.instructions || '').trim().slice(0, 4000);
      if (title.length < 3 || instructions.length < 5) throw bad('Sarlavha va ko\'rsatmani kiriting');
      const mode = ['write', 'speak', 'confirm'].includes(body.mode) ? body.mode : 'confirm';
      return { type: 'custom', ref: { title, instructions, mode, level: lvl, minWords: Number(body.minWords) || undefined }, minutes: 30 };
    }
    default: throw bad('Topshiriq turi noto\'g\'ri');
  }
}

async function suggestions(studentId, today) {
  const out = [];
  const alerts = await alertsFor(studentId, today);
  for (const a of alerts) {
    if (a.code === 'weak-topic') out.push({ code: 'remedial', unit: a.unit, title: `«${unitById[a.unit]?.title}» bo'yicha qo'shimcha takrorlash (3 ta, intervalli)`, why: a.text });
    if (a.code === 'behind') out.push({ code: 'replan', title: 'Rejani bugundan qayta tuzish (qoldirilgan mavzular saqlanadi)', why: a.text });
  }
  for (const t of await weakTopics(studentId)) if (!out.some((o) => o.unit === t)) out.push({ code: 'remedial', unit: t, title: `«${unitById[t]?.title || t}» — diagnostikadagi zaif mavzu`, why: 'Diagnostika va mashqlar natijasi past.' });
  return out.slice(0, 6);
}

async function applyRemedial(studentId, teacherId, unit, today) {
  const ids = [];
  for (const off of [1, 2, 4]) ids.push(await addTask(studentId, teacherId, { type: 'grammar', ref: { unit, mode: 'review' }, date: addDays(today, off), minutes: 35, note: 'Qo\'shimcha takrorlash (zaif mavzu)', source: 'remedial' }));
  return ids;
}

export function registerTeacher(r) {
  const T = { role: 'teacher' };

  r.get('/api/teacher/students', async ({ user, date }) => ({ inviteCode: user.invite_code, students: await studentsOverview(user.id, date) }), T);

  r.get('/api/teacher/weekly', async ({ user, date }) => weeklyReport(user.id, date), T);
  r.get('/api/teacher/weekly.csv', async ({ user, date }) => {
    const w = await weeklyReport(user.id, date);
    return csv([['Ism', 'Rejalashtirilgan', 'Bajarilgan', 'Bajarish %', 'Daqiqa (shu hafta)', 'Daqiqa (oldingi hafta)', 'Faol kunlar', "Yangi so'z", 'Speaking', "O'rtacha ball %", 'Belgilar'],
      ...w.students.map((s) => [s.name, s.planned, s.done, s.completion ?? '', s.minutes, s.prevMinutes, s.activeDays, s.newWords, s.speaking, s.avgScore ?? '', s.flags.join(' ')])], `haftalik-${w.to}.csv`);
  }, T);
  r.post('/api/teacher/weekly/summary', async ({ user, date }) => { rateLimit(user.id, 'ai', 40); return weeklySummary(await weeklyReport(user.id, date)); }, T);

  r.get('/api/teacher/students/:id', async ({ user, params, date }) => {
    const s = await myStudent(user, params.id);
    const ab = await abilities(s.id);
    const diag = await q.get("SELECT result_json FROM diagnostics WHERE user_id=? AND status='done' ORDER BY id DESC LIMIT 1", s.id);
    const plan = await activePlan(s.id);
    const upcoming = await Promise.all((await q.all("SELECT date FROM tasks WHERE user_id=? AND date>=? GROUP BY date ORDER BY date LIMIT 7", s.id, date)).map((d) => dayView(s.id, d.date)));
    const recent = (await q.all('SELECT a.*, t.type AS task_type, t.date AS task_date FROM attempts a LEFT JOIN tasks t ON t.id=a.task_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30', s.id))
      .map((a) => ({ id: a.id, skill: a.skill, topic: unitById[a.topic]?.title || a.topic, stage: a.stage_key, score: a.score, feedback: a.feedback, tone: a.tone, ai: !!a.ai, at: a.created_at, taskType: a.task_type, taskDate: a.task_date }));
    const sessions = (await q.all('SELECT id, persona, level, mode, status, report_json, created_at FROM speaking_sessions WHERE user_id=? ORDER BY id DESC LIMIT 10', s.id))
      .map((x) => { const rep = unj(x.report_json); return { id: x.id, persona: x.persona, level: x.level, mode: x.mode, status: x.status, cefr: rep?.cefr ?? null, band: rep?.band ?? null, created: x.created_at }; });
    return {
      student: { id: s.id, name: s.name, email: s.email, tone: s.feedback_tone, todayTone: await effectiveTone(s.id, date), joined: s.created_at },
      level: overall(ab) == null ? null : describe(overall(ab)),
      skills: SKILLS.map((k) => ({ skill: k, name: SKILL_UZ[k], ...(ab[k] != null ? describe(ab[k]) : { ability: null }) })), history: await history(s.id),
      diagnostic: unj(diag?.result_json), goal: await q.get('SELECT * FROM goals WHERE user_id=?', s.id), plan: plan && plan.meta,
      stats: await statsFor(s.id, date), weakTopics: (await weakTopics(s.id)).map((id) => ({ id, title: unitById[id]?.title || id })), alerts: await alertsFor(s.id, date), suggestions: await suggestions(s.id, date),
      upcoming, recent, speakingSessions: sessions, notes: await q.all('SELECT id, text, created_at FROM teacher_notes WHERE student_id=? AND teacher_id=? ORDER BY id DESC LIMIT 20', s.id, user.id),
      materials: await listMaterialsFor(user.id, s.id), tones: TONES,
      tonesOverrides: await q.all('SELECT date, tone FROM tone_overrides WHERE student_id=? AND date>=? ORDER BY date', s.id, date),
    };
  }, T);

  r.get('/api/teacher/students/:id/analysis', async ({ user, params, date }) => { const s = await myStudent(user, params.id); return analyseGoal(s.id, date); }, T);

  r.put('/api/teacher/students/:id/tone', async ({ user, params, body }) => {
    const s = await myStudent(user, params.id);
    if (!isTone(body.tone)) throw bad('Fikr-mulohaza turi noto\'g\'ri');
    if (body.date) {
      if (!isDate(body.date)) throw bad('Sana noto\'g\'ri');
      await q.run('INSERT INTO tone_overrides(student_id,date,tone) VALUES(?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET tone=excluded.tone', s.id, body.date, body.tone);
    } else await q.run('UPDATE users SET feedback_tone=? WHERE id=?', body.tone, s.id);
    return { ok: true };
  }, T);
  r.delete('/api/teacher/students/:id/tone/:date', async ({ user, params }) => { const s = await myStudent(user, params.id); await q.run('DELETE FROM tone_overrides WHERE student_id=? AND date=?', s.id, params.date); return { ok: true }; }, T);

  r.post('/api/teacher/students/:id/tasks', async ({ user, params, body, date }) => {
    const s = await myStudent(user, params.id);
    const spec = buildTaskSpec(body);
    const d = isDate(body.date) ? body.date : date;
    if (diffDays(date, d) > 365 || diffDays(d, date) > 30) throw bad('Sana oralig\'i noto\'g\'ri');
    const minutes = Math.min(180, Math.max(10, Number(body.minutes) || spec.minutes));
    const id = await addTask(s.id, user.id, { ...spec, date: d, minutes, note: String(body.note || '').slice(0, 500) });
    return { id };
  }, T);

  r.delete('/api/teacher/students/:id/tasks/:taskId', async ({ user, params }) => {
    const s = await myStudent(user, params.id);
    const t = await q.get('SELECT * FROM tasks WHERE id=? AND user_id=?', Number(params.taskId), s.id);
    if (!t) throw new HttpError(404, 'Topshiriq topilmadi');
    if (t.status === 'done') throw bad('Bajarilgan topshiriqni o\'chirib bo\'lmaydi');
    await q.run('DELETE FROM tasks WHERE id=?', t.id);
    return { ok: true };
  }, T);

  r.post('/api/teacher/students/:id/remedial', async ({ user, params, body, date }) => {
    const s = await myStudent(user, params.id);
    if (!unitById[body.unit]) throw bad('Mavzu topilmadi');
    return { ids: await applyRemedial(s.id, user.id, body.unit, date) };
  }, T);

  r.post('/api/teacher/students/:id/replan', async ({ user, params, body, date }) => {
    const s = await myStudent(user, params.id);
    const goal = await q.get('SELECT * FROM goals WHERE user_id=?', s.id);
    if (!goal) throw bad("O'quvchi hali maqsad belgilamagan");
    let { target_cefr, target_ielts, deadline, hours_per_day } = goal;
    if (body.targetCefr || body.targetIelts) { const t = resolveTarget(body); target_cefr = t.cefr; target_ielts = t.ielts; }
    if (body.deadline || body.months || body.weeks) deadline = resolveDeadline(body, date);
    if (body.hoursPerDay) hours_per_day = Math.min(10, Math.max(1.5, Number(body.hoursPerDay)));
    await q.run('UPDATE goals SET target_cefr=?, target_ielts=?, deadline=?, hours_per_day=? WHERE user_id=?', target_cefr, target_ielts, deadline, hours_per_day, s.id);
    const out = await generatePlan({ userId: s.id, goal: await q.get('SELECT * FROM goals WHERE user_id=?', s.id), from: date, assignedBy: user.id });
    return { ok: true, tasks: out.tasks };
  }, T);

  r.post('/api/teacher/students/:id/auto-adjust', async ({ user, params, date }) => {
    const s = await myStudent(user, params.id);
    const sug = await suggestions(s.id, date);
    let remedial = 0, replanned = false;
    for (const x of sug) {
      if (x.code === 'remedial' && remedial < 3) { await applyRemedial(s.id, user.id, x.unit, date); remedial++; }
      if (x.code === 'replan' && !replanned) {
        const goal = await q.get('SELECT * FROM goals WHERE user_id=?', s.id);
        if (goal) { await generatePlan({ userId: s.id, goal, from: date, assignedBy: user.id }); replanned = true; }
      }
    }
    return { remedial, replanned };
  }, T);

  r.post('/api/teacher/students/:id/notes', async ({ user, params, body }) => {
    const s = await myStudent(user, params.id);
    const text = String(body.text || '').trim().slice(0, 2000);
    if (text.length < 2) throw bad('Izoh bo\'sh');
    await q.run('INSERT INTO teacher_notes(teacher_id,student_id,text) VALUES(?,?,?)', user.id, s.id, text);
    return { ok: true };
  }, T);

  r.post('/api/teacher/students/:id/message', async ({ user, params, body }) => {
    const s = await myStudent(user, params.id);
    const text = String(body.text || '').trim().slice(0, 1000);
    if (text.length < 2) throw bad('Xabar bo\'sh');
    await q.run('INSERT INTO messages(teacher_id,student_id,text) VALUES(?,?,?)', user.id, s.id, text);
    return { ok: true };
  }, T);
  r.get('/api/teacher/students/:id/messages', async ({ user, params }) => {
    const s = await myStudent(user, params.id);
    return q.all('SELECT id, text, read, created_at FROM messages WHERE student_id=? AND teacher_id=? ORDER BY id DESC LIMIT 20', s.id, user.id);
  }, T);

  r.get('/api/teacher/students/:id/speaking/:sid', async ({ user, params }) => {
    const s = await myStudent(user, params.id);
    const row = await q.get('SELECT * FROM speaking_sessions WHERE id=? AND user_id=?', Number(params.sid), s.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    return sessionView(row, unj(row.turns_json, []));
  }, T);

  r.get('/api/teacher/students/:id/task/:taskId', async ({ user, params }) => {
    const s = await myStudent(user, params.id);
    const row = await q.get('SELECT * FROM tasks WHERE id=? AND user_id=?', Number(params.taskId), s.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    const t = hydrate(row);
    return { id: t.id, type: t.type, ...describeTask(t), minutes: t.minutes, status: t.status, score: t.score, attempts: await previousAttempts(t.id) };
  }, T);

  r.get('/api/teacher/catalog', async () => ({
    units: units.map((u) => ({ id: u.id, title: u.title, level: u.level })),
    topics: topicCatalog.map((t) => ({ id: t.id, title: t.title, level: t.level })), levels: LEVELS,
  }), T);

  // Teacher-initiated password reset (no e-mail service on the free plan): returns a one-time temporary password.
  r.post('/api/teacher/students/:id/reset-password', async ({ user, params }) => {
    const s = await myStudent(user, params.id);
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const temp = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => alphabet[b % alphabet.length]).join('');
    await q.run('UPDATE users SET pass_hash=? WHERE id=?', await hashPassword(temp), s.id);
    await q.run('DELETE FROM sessions WHERE user_id=?', s.id);
    return { password: temp };
  }, T);

  // CSV exports (cells starting with = + - @ are neutralised against spreadsheet formula injection).
  const cell = (v) => { let t = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const csv = (rows, name) => new Response('\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  r.get('/api/teacher/export.csv', async ({ user, date }) => {
    const list = await studentsOverview(user.id, date);
    return csv([['Ism', 'Email', 'CEFR', 'IELTS', 'Maqsad', 'Muddat', "Bajarilgan topshiriq", 'Daqiqa', "O'rganilgan so'z", 'Streak', "O'tkazib yuborilgan", 'Reja bajarilishi %', 'Oxirgi faollik'],
      ...list.map((s) => [s.name, s.email, s.level?.cefr, s.level?.ielts, s.goal ? `${s.goal.target_cefr} / ${s.goal.target_ielts}` : '', s.goal?.deadline, s.stats.tasksDone, s.stats.minutesDone, s.stats.wordsLearned, s.stats.streak, s.stats.missed, s.stats.completionRate, s.lastActive])], `oquvchilar-${date}.csv`);
  }, T);
  r.get('/api/teacher/students/:id/export.csv', async ({ user, params, date }) => {
    const s = await myStudent(user, params.id);
    const rows = await q.all('SELECT created_at, skill, topic, stage_key, score, tone, ai, feedback FROM attempts WHERE user_id=? ORDER BY id', s.id);
    return csv([['Sana', "Ko'nikma", 'Mavzu', 'Bosqich', 'Natija %', 'Uslub', 'AI', 'Fikr'], ...rows.map((a) => [a.created_at, a.skill, unitById[a.topic]?.title || a.topic, a.stage_key, a.score == null ? '' : Math.round(a.score * 100), a.tone, a.ai ? 'ha' : "yo'q", a.feedback])], `${s.name.replace(/[^\w-]+/g, '_')}-natijalar-${date}.csv`);
  }, T);

  // Word bank: shows how many words each IELTS topic / level has and tops it up with Gemini (40 new words per click).
  r.get('/api/teacher/vocab', async () => {
    const cache = await loadVocabCache();
    return {
      ai: aiEnabled(),
      topics: topicCatalog.map((t) => ({ id: t.id, title: t.title, level: t.level, words: topicPoolFrom(cache, t.id).length })),
      general: ['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => ({ level, words: generalPoolFrom(cache, level).length })),
    };
  }, T);
  r.post('/api/teacher/vocab/generate', async ({ user, body }) => {
    if (!aiEnabled()) throw bad("Gemini API kaliti ulanmagan");
    rateLimit(user.id, 'vocabgen', 12);
    if (body.topic) { if (!topicById[body.topic]) throw bad('Mavzu topilmadi'); await growTopic(body.topic, 40); }
    else if (['A1', 'A2', 'B1', 'B2', 'C1'].includes(body.level)) await growGeneral(body.level, 40);
    else throw bad('Mavzu yoki daraja kerak');
    return { ok: true };
  }, T);
}
