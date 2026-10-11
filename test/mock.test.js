import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, Client, today } from './helpers.js';

let srv, s, q;
const date = today();

before(async () => {
  srv = await boot({ GEMINI_API_KEY: '' });
  ({ q } = await import('../server/lib/db.js'));
  const D = await import('../server/content/diagnostic.js');
  s = new Client(srv.base, date);
  await s.post('/api/auth/register', { name: 'Mock Taker', email: 'mock@x.com', password: 'password1' });
  const ok = (a) => a.map((x) => x.a);
  await s.post('/api/diagnostic/section/grammar', { answers: ok(D.grammar) }); await s.post('/api/diagnostic/section/vocab', { answers: ok(D.vocab) });
  await s.post('/api/diagnostic/section/reading', { answers: D.reading.map((p) => ok(p.q)) }); await s.post('/api/diagnostic/section/listening', { answers: D.listening.map((p) => ok(p.q)) });
  await s.post('/api/diagnostic/section/writing', { texts: ['word '.repeat(60), 'word '.repeat(60)] });
  await s.post('/api/diagnostic/finish');
  await s.post('/api/goal', { targetIelts: 7, months: 6, hoursPerDay: 4 });
});
after(async () => { await srv.close(); });

const correct = async (id, section) => {
  const content = JSON.parse((await q.get('SELECT content_json FROM mock_tests WHERE id=?', id)).content_json)[section];
  return content.map((c) => c.q.map((x) => x.a));
};

test('band conversion and rounding follow IELTS conventions', async () => {
  const { rawToBand, roundBand, overallBand, writingBand } = await import('../server/lib/ielts.js');
  assert.equal(rawToBand(40, 40), 9); assert.equal(rawToBand(30, 40), 7); assert.equal(rawToBand(15, 40), 5); assert.equal(rawToBand(7, 10), 6.5, 'scaled to 40 questions');
  assert.equal(roundBand(6.25), 6.5); assert.equal(roundBand(6.75), 7); assert.equal(roundBand(6.2), 6);
  assert.equal(overallBand([6, 6.5, 7, 6.5]), 6.5); assert.equal(writingBand(6, 7), 6.5, 'task 2 counts double');
});

test('mock exam flow: sections are timed, content hides answers, one open exam at a time', async () => {
  let r = await s.get('/api/mock');
  assert.equal(r.status, 200); assert.equal(r.data.plans.mini.reading.minutes, 25); assert.equal(r.data.goal.target_ielts, 7);
  r = await s.post('/api/mock/start', { kind: 'mini' });
  const id = r.data.id;
  assert.equal((await s.post('/api/mock/start', { kind: 'full' })).data.resumed, true, 'resumes the open exam instead of creating another');
  assert.equal((await s.post(`/api/mock/${id}/finish`)).status, 400, 'cannot finish before sections are done');
  r = await s.post(`/api/mock/${id}/section/listening/start`);
  assert.equal(r.status, 200); assert.equal(r.data.limitSeconds, 15 * 60); assert.ok(r.data.remainingSeconds <= 900 && r.data.remainingSeconds > 890);
  assert.equal(r.data.clips.length, 2); assert.ok(r.data.clips[0].audio);
  assert.ok(!JSON.stringify(r.data).includes('"a":'), 'no answers leak');
  r = await s.post(`/api/mock/${id}/section/reading/start`);
  assert.equal(r.data.passages.length, 2);
  r = await s.post(`/api/mock/${id}/section/writing/start`);
  assert.equal(r.data.tasks.length, 2); assert.match(r.data.tasks[0].prompt, /150 words/); assert.deepEqual(r.data.tasks[1].words, [250, 320]);
  r = await s.post(`/api/mock/${id}/section/speaking/start`);
  assert.equal(r.data.parts.length, 3); assert.equal(r.data.parts[1].prep, 60);
  assert.equal((await s.post(`/api/mock/${id}/section/bogus/start`)).status, 400);
});

test('scoring: perfect answers give band 9, late sections are flagged, results update the learner profile', async () => {
  const id = (await s.get('/api/mock')).data.history[0].id;
  // Listening: perfect and on time
  let r = await s.post(`/api/mock/${id}/section/listening/submit`, { answers: await correct(id, 'listening') });
  assert.equal(r.status, 200); assert.equal(r.data.late, false);
  assert.equal((await s.post(`/api/mock/${id}/section/listening/submit`, { answers: [] })).status, 400, 'no double submission');
  // Reading: every answer wrong, and submitted long after the deadline
  const secs = JSON.parse((await q.get('SELECT sections_json FROM mock_tests WHERE id=?', id)).sections_json);
  secs.reading.started = Date.now() - 3 * 3600 * 1000;
  await q.run('UPDATE mock_tests SET sections_json=? WHERE id=?', JSON.stringify(secs), id);
  const wrong = (await correct(id, 'reading')).map((a) => a.map((x) => (x + 1) % 4));
  r = await s.post(`/api/mock/${id}/section/reading/submit`, { answers: wrong });
  assert.equal(r.data.late, true);
  r = await s.post(`/api/mock/${id}/section/writing/submit`, { texts: ['Dear Sir, I am writing to complain about the service at your hotel. '.repeat(14), 'Some people believe technology helps education, while others disagree. '.repeat(30)] });
  assert.equal(r.status, 200);
  const before = (await s.get('/api/progress')).data.skills;
  r = await s.post(`/api/mock/${id}/finish`);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.bands.listening, 9); assert.ok(r.data.bands.reading <= 2, 'all wrong -> very low band: ' + r.data.bands.reading);
  assert.ok(r.data.bands.writing > 0); assert.equal(r.data.bands.speaking, null);
  assert.equal(r.data.smallSample, true, 'tiny question pools are flagged');
  assert.equal(r.data.partial, true); assert.deepEqual(r.data.missingSections, ['speaking']);
  assert.deepEqual(r.data.late, ['reading']); assert.deepEqual(r.data.estimatedSections, ['writing'], 'offline writing grading is flagged as estimated');
  assert.equal(r.data.target, 7); assert.ok(r.data.gap > 0 && r.data.verdict === 'far');
  assert.ok(r.data.recommendations.some((x) => x.startsWith('Reading')));
  assert.ok(r.data.recommendations.some((x) => x.startsWith('Vaqt')), 'late warning');
  const after = (await s.get('/api/progress')).data.skills;
  const ab = (arr, k) => arr.find((x) => x.skill === k).ability;
  assert.ok(ab(after, 'listening') > ab(before, 'listening'), 'listening evidence applied');
  assert.ok(ab(after, 'reading') < ab(before, 'reading'), 'reading evidence applied');
  assert.equal(ab(after, 'writing'), ab(before, 'writing'), 'estimated writing band is not used as evidence');
  const hist = (await s.get('/api/mock')).data.history[0];
  assert.equal(hist.status, 'done'); assert.equal(hist.overall, r.data.overall);
  assert.equal((await s.post(`/api/mock/${id}/finish`)).data.overall, r.data.overall, 'finish is idempotent');
});

test('a new exam can be started after the previous one finished; other users cannot see it', async () => {
  const r = await s.post('/api/mock/start', { kind: 'full' });
  assert.equal(r.data.resumed, false);
  const other = new Client(srv.base, date);
  await other.post('/api/auth/register', { name: 'Other Person', email: 'other2@x.com', password: 'password1' });
  assert.equal((await other.get(`/api/mock/${r.data.id}`)).status, 404);
});
