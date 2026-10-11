import { q, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { buildLesson, publicStage } from '../lessons.js';
import { submitStage } from '../lib/submit.js';
import { ttsAudio } from '../lib/gemini.js';

export async function ownTask(user, id) {
  const t = await q.get('SELECT * FROM tasks WHERE id=?', Number(id));
  if (!t || t.user_id !== user.id) throw new HttpError(404, 'Topshiriq topilmadi');
  return t;
}

export async function previousAttempts(taskId) {
  const out = {};
  for (const a of await q.all('SELECT * FROM attempts WHERE task_id=? ORDER BY id', taskId)) {
    const d = unj(a.detail_json, {});
    out[a.stage_key] = { score: a.score, feedback: a.feedback, tone: a.tone, ai: !!a.ai, items: d.items || [], extra: d.extra || {}, at: a.created_at };
  }
  return out;
}

export function registerTasks(r) {
  r.get('/api/tasks/:id', async ({ user, params }) => {
    const row = await ownTask(user, params.id);
    const lesson = await buildLesson(row);
    return {
      task: { id: row.id, type: row.type, date: row.date, minutes: row.minutes, status: row.status, score: row.score, note: row.note, source: row.source },
      info: lesson.info, stages: lesson.stages.map(publicStage), previous: await previousAttempts(row.id),
    };
  }, { role: 'student' });

  r.post('/api/tasks/:id/stage/:key', async ({ user, params, body, date }) => {
    const row = await ownTask(user, params.id);
    return submitStage({ user, taskRow: row, stageKey: params.key, body, date });
  }, { role: 'student', limit: 40 * 1024 * 1024 });

  r.get('/api/tts/:id', async ({ params }) => {
    if (!/^[0-9a-f]{32}$/.test(params.id)) throw new HttpError(404, 'Audio topilmadi');
    const a = await ttsAudio(params.id);
    if (!a) throw new HttpError(404, 'Audio topilmadi');
    if (a.fallback) return { fallback: true, text: a.text };
    return new Response(a.body, { headers: { 'content-type': 'audio/wav', 'content-length': String(a.size), 'cache-control': 'private, max-age=86400' } });
  });
}
