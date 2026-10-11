// What the learner/teacher sees when Gemini rejects the request (wrong region, key, quota, model).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { boot, Client, today } from './helpers.js';

let fake, srv, mode = { status: 400, status_: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' };
let teacher, student;
before(async () => {
  fake = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      if (mode.ok) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true,"transcript":"hi","reply":"Fine.","notes":[],"hint":"","end":false}' }] } }] })); }
      res.writeHead(mode.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: mode.status, message: mode.message, status: mode.status_ } }));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  srv = await boot({ GEMINI_API_KEY: 'AIzaSyFAKEFAKEFAKEFAKEFAKEFAKEFAKE12345', GEMINI_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1beta` });
  teacher = new Client(srv.base, today()); student = new Client(srv.base, today());
  const t = await teacher.post('/api/auth/register', { name: 'Teach', email: 'e@x.com', password: 'password1', role: 'teacher' });
  await student.post('/api/auth/register', { name: 'Stud', email: 'f@x.com', password: 'password1', inviteCode: t.data.user.inviteCode });
});
after(async () => { await srv.close(); fake.close(); });

test('speaking: the real Gemini error is shown instead of a generic message', async () => {
  let r = await student.post('/api/speaking/start', { persona: 'victor', mode: 'free' });
  assert.equal(r.status, 200); assert.equal(r.data.ai, false);
  assert.match(r.data.aiError, /location is not supported/); assert.match(r.data.aiError, /400/);
  assert.ok(!r.data.aiError.includes('AIza'), 'the key is never echoed');
  r = await student.post(`/api/speaking/${r.data.id}/turn`, { text: 'I live in Tashkent.' });
  assert.equal(r.status, 502); assert.match(r.data.error, /AI hozir javob bera olmadi: .*location is not supported/);
});

test('status endpoint remembers the last error; trainers explain why a ready-made text was used', async () => {
  let r = await student.get('/api/ai/status');
  assert.match(r.data.lastError.message, /location is not supported/);
  r = await student.post('/api/trainers/reading/new', { mode: 'generate' });
  assert.equal(r.status, 200); assert.match(r.data.notice, /location is not supported/);
});

test('AI check: teacher-only, classifies the failure and gives a fix hint', async () => {
  assert.equal((await student.post('/api/ai/test')).status, 403);
  let r = await teacher.post('/api/ai/test');
  assert.equal(r.status, 200); assert.equal(r.data.allOk, false);
  assert.equal(r.data.tests.text.ok, false); assert.equal(r.data.tests.audio.ok, false); assert.equal(r.data.tests.tts.ok, false);
  assert.match(r.data.hint, /placement/);
  mode = { status: 400, status_: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' };
  assert.match((await teacher.post('/api/ai/test')).data.hint, /API kalit/);
  mode = { status: 404, status_: 'NOT_FOUND', message: 'models/gemini-x is not found' };
  assert.match((await teacher.post('/api/ai/test')).data.hint, /Model nomi/);
  mode = { ok: true };
  r = await teacher.post('/api/ai/test');
  assert.equal(r.data.tests.text.ok, true); assert.equal(r.data.tests.audio.ok, true);
});
