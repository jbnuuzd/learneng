import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { addDays, isDate, diffDays } from '../lib/dates.js';
import { abilities, overall, effectiveTone, history, SKILLS, SKILL_UZ } from '../lib/progress.js';
import { describe, LEVELS } from '../lib/scale.js';
import { TONES, isTone } from '../lib/ai.js';
import { unitById, units, topicCatalog, topicById } from '../lib/content.js';
import { generatePlan, activePlan, weakTopics, VOCAB, VOCAB_MINUTES } from '../planner.js';
import { describeTask, hydrate, TYPE_UZ } from '../lessons.js';
import { analyseGoal } from '../analysis.js';
import { dayView, statsFor, resolveTarget, resolveDeadline } from './plan.js';
import { previousAttempts } from './tasks.js';
import { sessionView } from './speaking.js';
import { listMaterialsFor } from './materials.js';

function myStudent(teacher, id) {
  const s = q.get("SELECT * FROM users WHERE id=? AND role='student'", Number(id));
  if (!s || s.teacher_id !== teacher.id) throw new HttpError(404, "O'quvchi topilmadi");
  return s;
}

export function alertsFor(studentId, today) {
  const out = [];
  const from7 = addDays(today, -7);
  const missed = q.get("SELECT COUNT(*) n FROM tasks WHERE user_id=? AND date<? AND date>=? AND status!='done'", studentId, today, from7).n;
  const planned = q.get('SELECT COUNT(*) n FROM tasks WHERE user_id=? AND date<? AND date>=?', studentId, today, from7).n;
  if (planned >= 3 && missed / planned >= 0.4) out.push({ level: 'danger', code: 'behind', text: `Oxirgi 7 kunda ${missed}/${planned} topshiriq bajarilmagan — grafikdan orqada.` });
  const last = q.get('SELECT MAX(created_at) t FROM attempts WHERE user_id=?', studentId).t;
  if (!last) out.push({ level: 'warn', code: 'inactive', text: 'Hali birorta mashq bajarmagan.' });
  else if (diffDays(last.slice(0, 10), today) >= 3) out.push({ level: 'warn', code: 'inactive', text: `${diffDays(last.slice(0, 10), today)} kundan beri faol emas.` });
  const low = q.all("SELECT topic, AVG(score) a, COUNT(*) n FROM attempts WHERE user_id=? AND skill='grammar' AND score IS NOT NULL AND topic IS NOT NULL AND created_at>=datetime('now','-14 day') GROUP BY topic HAVING n>=2 AND a<0.6", studentId);
  for (const l of low) out.push({ level: 'warn', code: 'weak-topic', unit: l.topic, text: `«${unitById[l.topic]?.title || l.topic}» mavzusida o'rtacha natija ${Math.round(l.a * 100)}%.` });
  return out;
}

function addTask(studentId, teacherId, { type, ref, date, minutes, note, source = 'teacher' }) {
  const ord = (q.get('SELECT MAX(ord) m FROM tasks WHERE user_id=? AND date=?', studentId, date).m ?? 0) + 1;
  const plan = activePlan(studentId);
  const id = q.run('INSERT INTO tasks(plan_id,user_id,date,ord,type,ref_json,minutes,source,note,assigned_by) VALUES(?,?,?,?,?,?,?,?,?,?)',
    plan?.id ?? null, studentId, date, ord, type, j(ref), minutes, source, note || null, teacherId).lastInsertRowid;
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

function suggestions(studentId, today) {
  const out = [];
  const alerts = alertsFor(studentId, today);
  for (const a of alerts) {
    if (a.code === 'weak-topic') out.push({ code: 'remedial', unit: a.unit, title: `«${unitById[a.unit]?.title}» bo'yicha qo'shimcha takrorlash (3 ta, intervalli)`, why: a.text });
    if (a.code === 'behind') out.push({ code: 'replan', title: 'Rejani bugundan qayta tuzish (qoldirilgan mavzular saqlanadi)', why: a.text });
  }
  for (const t of weakTopics(studentId)) if (!out.some((o) => o.unit === t)) out.push({ code: 'remedial', unit: t, title: `«${unitById[t]?.title || t}» — diagnostikadagi zaif mavzu`, why: 'Diagnostika va mashqlar natijasi past.' });
  return out.slice(0, 6);
}

function applyRemedial(studentId, teacherId, unit, today) {
  const ids = [];
  for (const off of [1, 2, 4]) ids.push(addTask(studentId, teacherId, { type: 'grammar', ref: { unit, mode: 'review' }, date: addDays(today, off), minutes: 35, note: 'Qo\'shimcha takrorlash (zaif mavzu)', source: 'remedial' }));
  return ids;
}

export function registerTeacher(r) {
  const T = { role: 'teacher' };

  r.get('/api/teacher/students', ({ user, date }) => {
    const rows = q.all("SELECT id,name,email,feedback_tone,created_at FROM users WHERE role='student' AND teacher_id=? ORDER BY name", user.id);
    return {
      inviteCode: user.invite_code,
      students: rows.map((s) => {
        const o = overall(abilities(s.id));
        const goal = q.get('SELECT target_cefr,target_ielts,deadline FROM goals WHERE user_id=?', s.id);
        const view = dayView(s.id, date);
        return { id: s.id, name: s.name, email: s.email, level: o == null ? null : describe(o), goal, tone: effectiveTone(s.id, date), today: { percent: view.percent, minutes: view.totalMinutes },
          alerts: alertsFor(s.id, date), stats: statsFor(s.id, date), lastActive: q.get('SELECT MAX(created_at) t FROM attempts WHERE user_id=?', s.id).t };
      }),
    };
  }, T);

  r.get('/api/teacher/students/:id', ({ user, params, date }) => {
    const s = myStudent(user, params.id);
    const ab = abilities(s.id);
    const diag = q.get("SELECT result_json FROM diagnostics WHERE user_id=? AND status='done' ORDER BY id DESC LIMIT 1", s.id);
    const plan = activePlan(s.id);
    const upcoming = q.all("SELECT date FROM tasks WHERE user_id=? AND date>=? GROUP BY date ORDER BY date LIMIT 7", s.id, date).map((d) => dayView(s.id, d.date));
    const recent = q.all('SELECT a.*, t.type AS task_type, t.date AS task_date FROM attempts a LEFT JOIN tasks t ON t.id=a.task_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 30', s.id)
      .map((a) => ({ id: a.id, skill: a.skill, topic: unitById[a.topic]?.title || a.topic, stage: a.stage_key, score: a.score, feedback: a.feedback, tone: a.tone, ai: !!a.ai, at: a.created_at, taskType: a.task_type, taskDate: a.task_date }));
    const sessions = q.all('SELECT id, persona, level, mode, status, report_json, created_at FROM speaking_sessions WHERE user_id=? ORDER BY id DESC LIMIT 10', s.id)
      .map((x) => { const rep = unj(x.report_json); return { id: x.id, persona: x.persona, level: x.level, mode: x.mode, status: x.status, cefr: rep?.cefr ?? null, band: rep?.band ?? null, created: x.created_at }; });
    return {
      student: { id: s.id, name: s.name, email: s.email, tone: s.feedback_tone, todayTone: effectiveTone(s.id, date), joined: s.created_at },
      level: overall(ab) == null ? null : describe(overall(ab)),
      skills: SKILLS.map((k) => ({ skill: k, name: SKILL_UZ[k], ...(ab[k] != null ? describe(ab[k]) : { ability: null }) })), history: history(s.id),
      diagnostic: unj(diag?.result_json), goal: q.get('SELECT * FROM goals WHERE user_id=?', s.id), plan: plan && plan.meta,
      stats: statsFor(s.id, date), weakTopics: weakTopics(s.id).map((id) => ({ id, title: unitById[id]?.title || id })), alerts: alertsFor(s.id, date), suggestions: suggestions(s.id, date),
      upcoming, recent, speakingSessions: sessions, notes: q.all('SELECT id, text, created_at FROM teacher_notes WHERE student_id=? AND teacher_id=? ORDER BY id DESC LIMIT 20', s.id, user.id),
      materials: listMaterialsFor(user.id, s.id), tones: TONES,
      tonesOverrides: q.all('SELECT date, tone FROM tone_overrides WHERE student_id=? AND date>=? ORDER BY date', s.id, date),
    };
  }, T);

  r.get('/api/teacher/students/:id/analysis', async ({ user, params, date }) => { const s = myStudent(user, params.id); return analyseGoal(s.id, date); }, T);

  r.put('/api/teacher/students/:id/tone', ({ user, params, body }) => {
    const s = myStudent(user, params.id);
    if (!isTone(body.tone)) throw bad('Fikr-mulohaza turi noto\'g\'ri');
    if (body.date) {
      if (!isDate(body.date)) throw bad('Sana noto\'g\'ri');
      q.run('INSERT INTO tone_overrides(student_id,date,tone) VALUES(?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET tone=excluded.tone', s.id, body.date, body.tone);
    } else q.run('UPDATE users SET feedback_tone=? WHERE id=?', body.tone, s.id);
    return { ok: true };
  }, T);
  r.delete('/api/teacher/students/:id/tone/:date', ({ user, params }) => { const s = myStudent(user, params.id); q.run('DELETE FROM tone_overrides WHERE student_id=? AND date=?', s.id, params.date); return { ok: true }; }, T);

  r.post('/api/teacher/students/:id/tasks', ({ user, params, body, date }) => {
    const s = myStudent(user, params.id);
    const spec = buildTaskSpec(body);
    const d = isDate(body.date) ? body.date : date;
    if (diffDays(date, d) > 365 || diffDays(d, date) > 30) throw bad('Sana oralig\'i noto\'g\'ri');
    const minutes = Math.min(180, Math.max(10, Number(body.minutes) || spec.minutes));
    const id = addTask(s.id, user.id, { ...spec, date: d, minutes, note: String(body.note || '').slice(0, 500) });
    return { id };
  }, T);

  r.delete('/api/teacher/students/:id/tasks/:taskId', ({ user, params }) => {
    const s = myStudent(user, params.id);
    const t = q.get('SELECT * FROM tasks WHERE id=? AND user_id=?', Number(params.taskId), s.id);
    if (!t) throw new HttpError(404, 'Topshiriq topilmadi');
    if (t.status === 'done') throw bad('Bajarilgan topshiriqni o\'chirib bo\'lmaydi');
    q.run('DELETE FROM tasks WHERE id=?', t.id);
    return { ok: true };
  }, T);

  r.post('/api/teacher/students/:id/remedial', ({ user, params, body, date }) => {
    const s = myStudent(user, params.id);
    if (!unitById[body.unit]) throw bad('Mavzu topilmadi');
    return { ids: applyRemedial(s.id, user.id, body.unit, date) };
  }, T);

  r.post('/api/teacher/students/:id/replan', ({ user, params, body, date }) => {
    const s = myStudent(user, params.id);
    const goal = q.get('SELECT * FROM goals WHERE user_id=?', s.id);
    if (!goal) throw bad("O'quvchi hali maqsad belgilamagan");
    let { target_cefr, target_ielts, deadline, hours_per_day } = goal;
    if (body.targetCefr || body.targetIelts) { const t = resolveTarget(body); target_cefr = t.cefr; target_ielts = t.ielts; }
    if (body.deadline || body.months || body.weeks) deadline = resolveDeadline(body, date);
    if (body.hoursPerDay) hours_per_day = Math.min(10, Math.max(1.5, Number(body.hoursPerDay)));
    q.run('UPDATE goals SET target_cefr=?, target_ielts=?, deadline=?, hours_per_day=? WHERE user_id=?', target_cefr, target_ielts, deadline, hours_per_day, s.id);
    const out = generatePlan({ userId: s.id, goal: q.get('SELECT * FROM goals WHERE user_id=?', s.id), from: date, assignedBy: user.id });
    return { ok: true, tasks: out.tasks };
  }, T);

  r.post('/api/teacher/students/:id/auto-adjust', ({ user, params, date }) => {
    const s = myStudent(user, params.id);
    const sug = suggestions(s.id, date);
    let remedial = 0, replanned = false;
    for (const x of sug) {
      if (x.code === 'remedial' && remedial < 3) { applyRemedial(s.id, user.id, x.unit, date); remedial++; }
      if (x.code === 'replan' && !replanned) {
        const goal = q.get('SELECT * FROM goals WHERE user_id=?', s.id);
        if (goal) { generatePlan({ userId: s.id, goal, from: date, assignedBy: user.id }); replanned = true; }
      }
    }
    return { remedial, replanned };
  }, T);

  r.post('/api/teacher/students/:id/notes', ({ user, params, body }) => {
    const s = myStudent(user, params.id);
    const text = String(body.text || '').trim().slice(0, 2000);
    if (text.length < 2) throw bad('Izoh bo\'sh');
    q.run('INSERT INTO teacher_notes(teacher_id,student_id,text) VALUES(?,?,?)', user.id, s.id, text);
    return { ok: true };
  }, T);

  r.get('/api/teacher/students/:id/speaking/:sid', ({ user, params }) => {
    const s = myStudent(user, params.id);
    const row = q.get('SELECT * FROM speaking_sessions WHERE id=? AND user_id=?', Number(params.sid), s.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    return sessionView(row, unj(row.turns_json, []));
  }, T);

  r.get('/api/teacher/students/:id/task/:taskId', ({ user, params }) => {
    const s = myStudent(user, params.id);
    const row = q.get('SELECT * FROM tasks WHERE id=? AND user_id=?', Number(params.taskId), s.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    const t = hydrate(row);
    return { id: t.id, type: t.type, ...describeTask(t), minutes: t.minutes, status: t.status, score: t.score, attempts: previousAttempts(t.id) };
  }, T);

  r.get('/api/teacher/catalog', () => ({
    units: units.map((u) => ({ id: u.id, title: u.title, level: u.level })),
    topics: topicCatalog.map((t) => ({ id: t.id, title: t.title, level: t.level })), levels: LEVELS,
  }), T);
}
