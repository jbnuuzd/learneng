// Spaced repetition (Leitner boxes): a correct answer moves a word up a box and pushes its next review further out.
import { q, j, unj } from './db.js';
import { addDays } from './dates.js';

export const INTERVALS = [1, 3, 7, 14, 30, 60];          // days until the next review, by box
export const MAX_BOX = INTERVALS.length - 1;
const DUE_EXPR = "COALESCE(due, date(learned_on, '+1 day'))";

export async function dueWords(userId, date, limit = 30) {
  return q.all(`SELECT word, box, right_n, wrong_n FROM learned_words WHERE user_id=? AND ${DUE_EXPR} <= ? ORDER BY ${DUE_EXPR}, wrong_n DESC LIMIT ?`, userId, date, limit);
}
export async function dueCount(userId, date) {
  return (await q.get(`SELECT COUNT(*) n FROM learned_words WHERE user_id=? AND ${DUE_EXPR} <= ?`, userId, date)).n;
}

// results: [{ word, ok }]. firstExposure: a first quiz after learning only lifts the word to box 1 (3-day review).
export async function recordResults(userId, results, date, { firstExposure = false } = {}) {
  const words = [...new Set(results.map((r) => r.word))];
  if (!words.length) return;
  const rows = await q.all(`SELECT word, box FROM learned_words WHERE user_id=? AND word IN (${words.map(() => '?').join(',')})`, userId, ...words);
  const box = new Map(rows.map((r) => [r.word, r.box]));
  const upd = results.filter((r) => box.has(r.word)).map((r) => {
    const cur = box.get(r.word);
    const next = r.ok ? (firstExposure ? Math.max(cur, 1) : Math.min(cur + 1, MAX_BOX)) : 0;
    return { w: r.word, box: next, due: addDays(date, INTERVALS[next]), r: r.ok ? 1 : 0, x: r.ok ? 0 : 1 };
  });
  if (!upd.length) return;
  await q.run(`UPDATE learned_words SET box = x.box, due = x.due, right_n = learned_words.right_n + x.r, wrong_n = learned_words.wrong_n + x.x
    FROM (SELECT json_extract(value,'$.w') AS w, json_extract(value,'$.box') AS box, json_extract(value,'$.due') AS due, json_extract(value,'$.r') AS r, json_extract(value,'$.x') AS x FROM json_each(?)) AS x
    WHERE learned_words.user_id=? AND learned_words.word = x.w`, j(upd), userId);
}

// Adds today's review task (once per day) when enough words are due. Called for the learner's own "today" views.
export async function ensureSrsTask(userId, date) {
  if (await q.get("SELECT 1 FROM tasks WHERE user_id=? AND date=? AND type='srs'", userId, date)) return;
  const n = await dueCount(userId, date);
  if (n < 3) return;
  const count = Math.min(n, 30);
  const plan = await q.get('SELECT id FROM plans WHERE user_id=? AND active=1 ORDER BY id DESC LIMIT 1', userId);
  await q.run("INSERT INTO tasks(plan_id,user_id,date,ord,type,ref_json,minutes,source) VALUES(?,?,?,?,?,?,?,'plan')",
    plan?.id ?? null, userId, date, -1, 'srs', j({ count, due: n }), Math.max(5, Math.min(25, Math.ceil(count * 0.6))));
}

export async function srsStats(userId, date) {
  const t = await q.get(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN ${DUE_EXPR} <= ? THEN 1 ELSE 0 END),0) due, COALESCE(SUM(CASE WHEN box>=4 THEN 1 ELSE 0 END),0) mastered,
    COALESCE(SUM(right_n),0) r, COALESCE(SUM(wrong_n),0) w FROM learned_words WHERE user_id=?`, date, userId);
  const boxes = Object.fromEntries((await q.all('SELECT box, COUNT(*) n FROM learned_words WHERE user_id=? GROUP BY box', userId)).map((b) => [b.box, b.n]));
  return { total: t.total, due: t.due, mastered: t.mastered, answers: t.r + t.w, accuracy: t.r + t.w ? Math.round((t.r / (t.r + t.w)) * 100) : null, boxes: INTERVALS.map((_, i) => boxes[i] || 0) };
}
