import { q } from './db.js';
import { clamp, describe, toCefr } from './scale.js';
import { isTone } from './ai.js';

export const SKILLS = ['grammar', 'vocab', 'reading', 'listening', 'writing', 'speaking'];
export const SKILL_UZ = { grammar: 'Grammatika', vocab: "Lug'at", reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };
const W = { grammar: 0.2, vocab: 0.1, reading: 0.2, listening: 0.2, writing: 0.15, speaking: 0.15 };

export async function abilities(userId) {
  const out = {};
  for (const r of await q.all('SELECT skill, ability FROM skill_progress WHERE user_id=?', userId)) out[r.skill] = r.ability;
  return out;
}
export function overall(ab) {
  let s = 0, w = 0;
  for (const k of SKILLS) if (ab[k] != null) { s += ab[k] * W[k]; w += W[k]; }
  return w ? s / w : null;
}
export async function setAbility(userId, skill, ability, date) {
  const a = Math.round(clamp(ability, 0, 100) * 10) / 10;
  await q.run('INSERT INTO skill_progress(user_id,skill,ability) VALUES(?,?,?) ON CONFLICT(user_id,skill) DO UPDATE SET ability=excluded.ability, updated_at=datetime(\'now\')', userId, skill, a);
  await q.run('INSERT INTO skill_history(user_id,skill,date,ability) VALUES(?,?,?,?) ON CONFLICT(user_id,skill,date) DO UPDATE SET ability=excluded.ability', userId, skill, date, a);
}
// Exponential moving average toward new evidence; `w` is how much one exercise should move the estimate.
export async function applyEvidence(userId, skill, evidence, w, date) {
  if (!skill || evidence == null) return;
  const cur = (await q.get('SELECT ability FROM skill_progress WHERE user_id=? AND skill=?', userId, skill))?.ability;
  await setAbility(userId, skill, cur == null ? evidence : cur * (1 - w) + evidence * w, date);
}
export async function currentLevel(userId) {
  const ab = await abilities(userId);
  const o = overall(ab);
  return o == null ? null : { overall: describe(o), skills: Object.fromEntries(Object.entries(ab).map(([k, v]) => [k, describe(v)])) };
}
// Level used for trainers: the learner's achieved level (overall, falling back to B1).
export async function achievedCefr(userId) {
  const o = overall(await abilities(userId));
  return o == null ? 'B1' : toCefr(o);
}

export async function effectiveTone(studentId, date) {
  const o = (await q.get('SELECT tone FROM tone_overrides WHERE student_id=? AND date=?', studentId, date))?.tone;
  if (o && isTone(o)) return o;
  const d = (await q.get('SELECT feedback_tone FROM users WHERE id=?', studentId))?.feedback_tone;
  return isTone(d) ? d : 'neutral';
}

export async function history(userId, days = 120) {
  const rows = await q.all('SELECT skill, date, ability FROM skill_history WHERE user_id=? ORDER BY date', userId);
  const out = {};
  for (const r of rows) (out[r.skill] ||= []).push({ date: r.date, ability: r.ability });
  return out;
}
