// Personal trajectory planner: turns (current level, target, deadline, hours/day) into dated daily tasks.
import { q, j, unj, stmt, batch } from './lib/db.js';
import { addDays, diffDays } from './lib/dates.js';
import { clamp, toCefr, levelIndex, LEVELS, goalAbility } from './lib/scale.js';
import { abilities, overall } from './lib/progress.js';
import { units, topicCatalog } from './lib/content.js';

export const VOCAB = { nTopic: 40, nGeneral: 12 };          // 52 new words / day (>= 50), 40 of them from one IELTS topic
export const VOCAB_MINUTES = 48;
export const NEW_WORDS_PER_DAY = VOCAB.nTopic + VOCAB.nGeneral;
export const HOURS_PER_LEVEL = 200;                          // ~guided learning hours per CEFR level (Cambridge's commonly quoted figure)
export const SAFETY = 1.35;                                  // plan for more than the bare minimum: people differ and miss days
export const POINTS_PER_LEVEL = 20;
const MIN_M = { grammar: 30, reading: 20, listening: 20, speaking: 15, writing: 20 };
const MAX_M = { grammar: 110, reading: 45, listening: 45, speaking: 40, writing: 50 };
const BASE_SHARE = { grammar: 0.38, reading: 0.14, listening: 0.16, speaking: 0.16, writing: 0.16 };
const ORDER = ['grammar', 'reading', 'listening', 'speaking', 'writing'];
const THEMES = ['education', 'environment', 'technology', 'health', 'work', 'travel', 'society', 'media', 'science', 'culture', 'family', 'sport'];

// ---- weaknesses ---------------------------------------------------------------
export async function weakTopics(userId) {
  const acc = {};
  const diag = await q.get("SELECT result_json FROM diagnostics WHERE user_id=? AND status='done' ORDER BY id DESC LIMIT 1", userId);
  const r = unj(diag?.result_json);
  for (const [t, v] of Object.entries(r?.topics || {})) acc[t] = { s: v.correct, n: v.total };
  for (const row of await q.all("SELECT topic, AVG(score) a, COUNT(*) n FROM attempts WHERE user_id=? AND skill='grammar' AND score IS NOT NULL AND topic IS NOT NULL GROUP BY topic", userId)) {
    const c = acc[row.topic] || { s: 0, n: 0 };
    acc[row.topic] = { s: c.s + row.a * row.n * 2, n: c.n + row.n * 2 };
  }
  return Object.entries(acc).filter(([, v]) => v.n >= 1 && v.s / v.n < 0.65).map(([t]) => t);
}

// ---- preview (feasibility of the goal) --------------------------------------------
export function previewGoal({ current, target, start, deadline, skills = {} }) {
  const days = Math.max(1, diffDays(start, deadline));
  const gapPoints = Math.max(0, target - current);
  const levels = gapPoints / POINTS_PER_LEVEL;
  const requiredHours = Math.max(20, Math.round(levels * HOURS_PER_LEVEL));
  const effective = 0.85;                                    // allow for missed days
  const rec = clamp(Math.ceil(((requiredHours * SAFETY) / (days * effective)) * 2) / 2, 2.5, 12);
  return { days, gapPoints: Math.round(gapPoints * 10) / 10, gapLevels: Math.round(levels * 100) / 100, requiredHours, recommendedHoursPerDay: rec,
    minHoursForWords: 1.5, realistic: rec <= 5, stretch: rec > 5 && rec <= 7, unrealistic: rec > 7 };
}

// ---- plan generation --------------------------------------------------------------
function chooseUnits({ currentLevel, targetLevel, weak, doneNew, slots }) {
  const ci = levelIndex(currentLevel), ti = levelIndex(targetLevel);
  const candidates = units.filter((u) => !doneNew.has(u.id) && levelIndex(u.level) <= Math.max(ti, ci) + 0);
  // everything from (current level) up to the target is needed; below-level units only if weak
  let need = candidates.filter((u) => levelIndex(u.level) >= ci || weak.includes(u.id));
  if (!need.length) need = units.filter((u) => !doneNew.has(u.id)).slice(-slots);
  if (need.length > slots) { // not enough lessons for the time: keep weak topics first, then the earliest needed
    const pri = need.map((u) => ({ u, p: (weak.includes(u.id) ? 0 : 1) + (levelIndex(u.level) < ci ? 0.5 : 0) }));
    pri.sort((a, b) => a.p - b.p || a.u.order - b.u.order);
    need = pri.slice(0, slots).map((x) => x.u).sort((a, b) => a.order - b.order);
  }
  return need;
}

export async function generatePlan({ userId, goal, from, assignedBy = null }) {
  const ab = await abilities(userId);
  const cur = overall(ab) ?? 40;
  const targetAbility = goalAbility(goal);
  const start = from > goal.start_date ? from : goal.start_date;
  const days = diffDays(start, goal.deadline);
  if (days < 1) throw new Error('Muddat tugagan');
  const M = Math.round(goal.hours_per_day * 60);
  const rem = Math.max(0, M - VOCAB_MINUTES);
  const weak = await weakTopics(userId);
  const avg = (ab.grammar + ab.reading + ab.listening + ab.speaking + ab.writing) / 5 || cur;

  // weakness-adjusted share per category
  const sh = {};
  let tot = 0;
  for (const c of ORDER) { const a = ab[c] ?? cur; sh[c] = BASE_SHARE[c] * (1 + clamp((avg - a) / 25, -0.3, 0.7)); tot += sh[c]; }
  for (const c of ORDER) sh[c] /= tot;

  const doneNew = new Set((await q.all("SELECT ref_json FROM tasks WHERE user_id=? AND type='grammar' AND status='done'", userId)).map((r) => unj(r.ref_json, {})).filter((r) => r.mode === 'new').map((r) => r.unit));

  // 1) lay out which categories appear on which day
  const acc = Object.fromEntries(ORDER.map((c) => [c, 0]));
  const plan = []; // [{date, tasks:[{type, minutes}]}]
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d);
    const light = 1; // every day carries the full daily budget
    const tasks = [];
    for (const c of ORDER) acc[c] += rem * light * sh[c];
    for (const c of ORDER) {
      if (acc[c] >= MIN_M[c]) {
        const m = Math.min(MAX_M[c], Math.round(acc[c] / 5) * 5);
        tasks.push({ type: c === 'grammar' ? 'grammar' : c, minutes: Math.max(MIN_M[c], m) });
        acc[c] -= Math.max(MIN_M[c], m);
      }
    }
    plan.push({ date, tasks });
  }
  const count = (type) => plan.reduce((n, p) => n + p.tasks.filter((t) => t.type === type).length, 0);

  // 2) grammar units: new lessons spread evenly, other grammar slots become spaced review
  const gSlots = count('grammar');
  const seq = chooseUnits({ currentLevel: toCefr(cur), targetLevel: goal.target_cefr, weak, doneNew, slots: Math.max(gSlots, 1) });
  const newAt = new Set(seq.map((_, i) => Math.floor((i * gSlots) / Math.max(seq.length, 1))));
  const introduced = [];                                      // units already introduced (for review picks)
  const reviewCount = Object.create(null);
  let gi = 0, ni = 0;
  const skillSlots = Object.fromEntries(['reading', 'listening', 'speaking', 'writing'].map((c) => [c, { n: count(c), k: 0 }]));

  // 3) vocabulary topic rotation
  const topicUse = Object.create(null);
  const pickTopic = (levelIdx) => {
    const sorted = [...topicCatalog].sort((a, b) => ((topicUse[a.id] || 0) - (topicUse[b.id] || 0)) || (Math.abs(levelIndex(a.level) - levelIdx) - Math.abs(levelIndex(b.level) - levelIdx)));
    topicUse[sorted[0].id] = (topicUse[sorted[0].id] || 0) + 1;
    return sorted[0];
  };

  const rows = [];
  plan.forEach((p, di) => {
    const frac = days > 1 ? di / (days - 1) : 1;
    const dayAbility = cur + (targetAbility - cur) * frac;
    let todayUnit = null;
    let ord = 0;
    for (const t of p.tasks.filter((x) => x.type === 'grammar')) {
      let ref;
      if (newAt.has(gi) && ni < seq.length) { const u = seq[ni++]; todayUnit = u; introduced.push(u); ref = { unit: u.id, mode: 'new' }; }
      else {
        const pool = introduced.length ? introduced : [...units.filter((u) => doneNew.has(u.id)), seq[0]].filter(Boolean);
        const best = [...pool].sort((a, b) => ((reviewCount[a.id] || 0) - (weak.includes(a.id) ? 1 : 0)) - ((reviewCount[b.id] || 0) - (weak.includes(b.id) ? 1 : 0)))[0] || units[0];
        reviewCount[best.id] = (reviewCount[best.id] || 0) + 1; todayUnit = best; ref = { unit: best.id, mode: 'review' };
      }
      gi++;
      rows.push({ date: p.date, ord: ord++ + 1, type: 'grammar', minutes: t.minutes, ref });
    }
    // vocabulary every day (>= 50 new words)
    const topic = pickTopic(levelIndex(toCefr(dayAbility)));
    rows.push({ date: p.date, ord: 0, type: 'vocab', minutes: VOCAB_MINUTES, ref: { topic: topic.id, level: topic.level, ...VOCAB } });
    for (const t of p.tasks.filter((x) => x.type !== 'grammar')) {
      const s = skillSlots[t.type];
      const frac2 = s.n > 1 ? s.k / (s.n - 1) : 1; s.k++;
      const base = ab[t.type] ?? cur;
      const level = toCefr(clamp(base + (targetAbility - base) * frac2 * 0.9 + 3, 0, 100));
      const ref = { level, topic: THEMES[(di + s.k * 3) % THEMES.length] };
      if ((t.type === 'speaking' || t.type === 'writing') && todayUnit) ref.focus = todayUnit.focus;
      if (t.type === 'speaking') ref.n = Math.max(1, Math.round(t.minutes / 8));
      rows.push({ date: p.date, ord: ord++ + 1, type: t.type, minutes: t.minutes, ref });
    }
  });

  const meta = { start, deadline: goal.deadline, days, minutesPerDay: M, hoursPerDay: goal.hours_per_day, shares: sh, targetCefr: goal.target_cefr, targetIelts: goal.target_ielts,
    startAbility: Math.round(cur * 10) / 10, targetAbility, units: seq.map((u) => u.id), weak, newWordsPerDay: NEW_WORDS_PER_DAY, generatedAt: new Date().toISOString(), generatedBy: assignedBy };

  // New plan row is created inactive; one atomic batch then swaps it in, clears untouched future tasks and inserts the new ones.
  const planId = (await q.run('INSERT INTO plans(user_id, meta_json, active) VALUES(?,?,0)', userId, j(meta))).lastInsertRowid;
  const stmts = [
    stmt("DELETE FROM tasks WHERE user_id=? AND source='plan' AND date>=? AND status='todo' AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.task_id=tasks.id)", userId, start),
    stmt('UPDATE plans SET active=0 WHERE user_id=?', userId),
  ];
  const INS = "INSERT INTO tasks(plan_id,user_id,date,ord,type,ref_json,minutes,source) SELECT ?, ?, json_extract(value,'$.d'), json_extract(value,'$.o'), json_extract(value,'$.t'), json_extract(value,'$.r'), json_extract(value,'$.m'), 'plan' FROM json_each(?)";
  for (let i = 0; i < rows.length; i += 250) {
    const chunk = rows.slice(i, i + 250).map((r) => ({ d: r.date, o: r.ord, t: r.type, r: j(r.ref), m: r.minutes }));
    stmts.push(stmt(INS, planId, userId, j(chunk)));
  }
  stmts.push(stmt('UPDATE plans SET active=1 WHERE id=?', planId));
  await batch(stmts);
  return { planId, meta, tasks: rows.length };
}

export const activePlan = async (userId) => {
  const p = await q.get('SELECT * FROM plans WHERE user_id=? AND active=1 ORDER BY id DESC LIMIT 1', userId);
  return p ? { ...p, meta: unj(p.meta_json, {}) } : null;
};
export { LEVELS };
