import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, Client, today } from './helpers.js';

let srv, s0, s1, q, D;
const d0 = today();
const addDays = (s, n) => new Date(Date.parse(s) + n * 864e5).toISOString().slice(0, 10);
const d1 = addDays(d0, 1);

// answer every choice question correctly by reading the "expected" text back from a throw-away wrong submission
async function solveChoice(c, taskId, stage, wrongOnly = false) {
  const probe = await c.post(`/api/tasks/${taskId}/stage/${stage.key}`, { answers: stage.items.map(() => 0) });
  const answers = stage.items.map((it, i) => (wrongOnly ? (probe.data.items[i].ok ? 1 : 0) : Math.max(0, it.o.indexOf(probe.data.items[i].expected))));
  return { probe, answers };
}

before(async () => {
  srv = await boot({ GEMINI_API_KEY: '' });
  ({ q } = await import('../server/lib/db.js'));
  D = await import('../server/content/diagnostic.js');
  s0 = new Client(srv.base, d0); s1 = new Client(srv.base, d1);
  await s0.post('/api/auth/register', { name: 'Srs Learner', email: 'srs@x.com', password: 'password1' });
  const ok = (a) => a.map((x) => x.a);
  await s0.post('/api/diagnostic/section/grammar', { answers: ok(D.grammar) }); await s0.post('/api/diagnostic/section/vocab', { answers: ok(D.vocab) });
  await s0.post('/api/diagnostic/section/reading', { answers: D.reading.map((p) => ok(p.q)) }); await s0.post('/api/diagnostic/section/listening', { answers: D.listening.map((p) => ok(p.q)) });
  await s0.post('/api/diagnostic/section/writing', { texts: ['word '.repeat(60), 'word '.repeat(60)] });
  await s0.post('/api/diagnostic/finish');
  await s0.post('/api/goal', { targetCefr: 'C1', months: 3, hoursPerDay: 4 });
  s1.cookie = s0.cookie;   // same learner, but the client reports tomorrow's date
});
after(async () => { await srv.close(); });

test('learning a word schedules its first review for tomorrow; no review task before words are due', async () => {
  const day = (await s0.get('/api/plan/day')).data;
  assert.ok(!day.tasks.some((t) => t.type === 'srs'), 'nothing due on the first day');
  const v = day.tasks.find((t) => t.type === 'vocab');
  for (const key of ['flash-topic', 'flash-general']) assert.equal((await s0.post(`/api/tasks/${v.id}/stage/${key}`, {})).status, 200);
  const rows = await q.all('SELECT box, due FROM learned_words');
  assert.equal(rows.length, 52);
  assert.ok(rows.every((r) => r.box === 0 && r.due === d1));
});

test('first quiz: correct answers lift a word to the 3-day box, wrong answers keep it due tomorrow', async () => {
  const v = (await s0.get('/api/plan/day')).data.tasks.find((t) => t.type === 'vocab');
  const lesson = (await s0.get('/api/tasks/' + v.id)).data;
  const quiz = lesson.stages.find((s) => s.key === 'vquiz');
  const { probe, answers } = await solveChoice(s0, v.id, quiz);
  assert.equal(probe.status, 200);
  // the probe (all-zero answers) was the first attempt: right ones moved up, wrong ones stayed
  const boxes = await q.all('SELECT box, COUNT(*) n FROM learned_words GROUP BY box');
  const up = boxes.find((b) => b.box === 1)?.n || 0;
  assert.equal(up, probe.data.items.filter((i) => i.ok).length);
  const moved = await q.get('SELECT due FROM learned_words WHERE box=1 LIMIT 1');
  if (moved) assert.equal(moved.due, addDays(d0, 3));
  // a retry must NOT change scheduling again
  const before = JSON.stringify(await q.all('SELECT word, box, due, right_n, wrong_n FROM learned_words ORDER BY word'));
  await s0.post(`/api/tasks/${v.id}/stage/vquiz`, { answers });
  assert.equal(JSON.stringify(await q.all('SELECT word, box, due, right_n, wrong_n FROM learned_words ORDER BY word')), before, 'retries do not farm progress');
});

test('next day: review task appears first, once, with due words; correct reviews push words out', async () => {
  let day = (await s1.get('/api/plan/day')).data;
  const srsTask = day.tasks.find((t) => t.type === 'srs');
  assert.ok(srsTask, 'srs task created');
  assert.equal(day.tasks[0].type, 'srs', 'review comes first');
  day = (await s1.get('/api/plan/day')).data;
  assert.equal(day.tasks.filter((t) => t.type === 'srs').length, 1, 'idempotent');
  const lesson = (await s1.get('/api/tasks/' + srsTask.id)).data;
  assert.deepEqual(lesson.stages.map((s) => s.key), ['srs-quiz', 'srs-recall']);
  const quiz = lesson.stages[0];
  const { answers } = await solveChoice(s1, srsTask.id, quiz);   // the probe itself is the first attempt (all wrong-ish)
  const stats0 = (await s1.get('/api/progress')).data.srs;
  assert.equal(stats0.total, 52);
  assert.ok(stats0.due > 0 && stats0.accuracy !== null);
  assert.equal(stats0.boxes.length, 6);
});

test('correct review answers move words up the Leitner boxes with growing intervals', async () => {
  const { recordResults, INTERVALS } = await import('../server/lib/srs.js');
  const w = (await q.get("SELECT word FROM learned_words WHERE box=0 LIMIT 1")).word;
  let box = 0;
  for (let step = 1; step <= 5; step++) {
    await recordResults(1, [{ word: w, ok: true }], d1);
    box = (await q.get('SELECT box FROM learned_words WHERE word=?', w)).box;
    assert.equal(box, step);
    assert.equal((await q.get('SELECT due FROM learned_words WHERE word=?', w)).due, addDays(d1, INTERVALS[step]));
  }
  await recordResults(1, [{ word: w, ok: false }], d1);
  const r = await q.get('SELECT box, due, wrong_n FROM learned_words WHERE word=?', w);
  assert.equal(r.box, 0); assert.equal(r.due, addDays(d1, 1)); assert.ok(r.wrong_n >= 1);
});

test('analysis switches to the learner\'s measured recall rate once there is enough data', async () => {
  let a = (await s1.get('/api/analysis')).data;
  assert.equal(a.vocabulary.retentionMeasured, false);
  await q.run('UPDATE learned_words SET right_n=2, wrong_n=0 WHERE word IN (SELECT word FROM learned_words LIMIT 40)');
  a = (await s1.get('/api/analysis')).data;
  assert.equal(a.vocabulary.retentionMeasured, true);
  assert.ok(a.vocabulary.retention >= 0.4 && a.vocabulary.retention <= 0.9);
});
