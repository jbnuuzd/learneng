// Several Gemini keys: when one hits its quota the next one is used.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { boot, Client, today } from './helpers.js';

let fake, srv, teacher; const used = [];
before(async () => {
  fake = http.createServer((req, res) => {
    req.resume(); req.on('end', () => {
      const k = req.headers['x-goog-api-key']; used.push(k);
      if (k === 'REJECTED-STUDENT-KEY-0000000') { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid' } })); }
      if (k === 'KEY-ONE-EXHAUSTED-0001') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } })); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(req.url.includes('/models?') ? { models: [] } : { candidates: [{ content: { parts: [{ text: '{"reply":"OK","uz":"ok","fix":"","transcript":"hi"}' }] } }] }));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  srv = await boot({ GEMINI_API_KEY: 'KEY-ONE-EXHAUSTED-0001, KEY-TWO-WORKING-0002', GEMINI_API_KEY_3: 'KEY-THREE-SPARE-0003', GEMINI_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1beta` });
  teacher = new Client(srv.base, today());
  await teacher.post('/api/auth/register', { name: 'Teacher', email: 'e@x.com', password: 'password1', role: 'teacher' });
});
after(async () => { await srv.close(); fake.close(); });

test('exhausted key is skipped; later calls go straight to the working key', async () => {
  const r = await teacher.post('/api/ai/test');
  assert.equal(r.data.tests.text.ok, true, JSON.stringify(r.data.tests.text));
  assert.deepEqual(used.slice(0, 2), ['KEY-ONE-EXHAUSTED-0001', 'KEY-TWO-WORKING-0002']);
  const n = used.length;
  await teacher.post('/api/ai/test');
  assert.ok(used.slice(n).every((k) => k !== 'KEY-ONE-EXHAUSTED-0001'), 'parked key is not retried');
  assert.equal(r.data.keys.length, 3);
});

test('teacher adds / lists / removes keys from the UI; added keys join the rotation', async () => {
  let r = await teacher.post('/api/ai/keys', { key: 'short' });
  assert.equal(r.status, 400);
  assert.equal((await teacher.post('/api/ai/keys', { key: 'GEMINI_API_KEY="AQ.Ab8RN6Kdotted_Key-1234567890xyz"' })).data.added, 1, 'newer dotted key format + pasted prefix accepted');
  r = await teacher.post('/api/ai/keys', { key: 'UI-KEY-FOUR-ABCDEFGHIJKLMN', label: 'Ali' });
  assert.equal(r.data.added, 1);
  const ui = r.data.keys.find((k) => k.key === '…KLMN');
  assert.ok(ui.id); assert.ok(!JSON.stringify(r.data).includes('UI-KEY-FOUR'), 'full key never returned');
  assert.equal((await teacher.post('/api/ai/keys', { key: 'UI-KEY-FOUR-ABCDEFGHIJKLMN' })).data.added, 0, 'duplicate ignored');
  r = await teacher.del('/api/ai/keys/' + ui.id);
  assert.equal(r.data.keys.filter((k) => k.source === 'ui').length, 1);
});

test('student with an own key: AI runs on that key only; other students use the shared pool; key is private', async () => {
  const code = (await teacher.get('/api/me')).data.user.inviteCode;
  const s1 = new Client(srv.base, today()), s2 = new Client(srv.base, today());
  await s1.post('/api/auth/register', { name: 'Own Key', email: 's1k@x.com', password: 'password1', inviteCode: code });
  await s2.post('/api/auth/register', { name: 'Shared One', email: 's2k@x.com', password: 'password1', inviteCode: code });
  assert.equal((await s1.post('/api/me/keys', { key: 'REJECTED-STUDENT-KEY-0000000' })).status, 400, 'invalid key is refused');
  assert.equal((await s1.post('/api/me/keys', { key: 'short' })).status, 400);
  let r = await s1.post('/api/me/keys', { key: 'STUDENT-OWN-KEY-0000000001', label: 'mening' });
  assert.equal(r.status, 200); assert.equal(r.data.keys[0].key, '…0001');
  assert.ok(!JSON.stringify(r.data).includes('STUDENT-OWN'), 'full key never returned');
  assert.equal((await s1.post('/api/me/keys', { key: 'STUDENT-OWN-KEY-0000000001' })).status, 400, 'duplicate');
  const n = used.length;
  r = await s1.post('/api/buddy/chat', { message: 'hello' });
  assert.equal(r.status, 200); assert.deepEqual([...new Set(used.slice(n))], ['STUDENT-OWN-KEY-0000000001'], 'own key only');
  await new Promise((r) => setTimeout(r, 300));   // let s1's TTS prewarm (which also runs on s1's key) finish
  const n2 = used.length;
  await s2.post('/api/buddy/chat', { message: 'hello' });
  assert.ok(used.slice(n2).every((k) => !k.startsWith('STUDENT-OWN')), 'others never touch the student key');
  assert.equal((await teacher.get('/api/me/keys')).status, 403);
  assert.equal((await s1.get('/api/me')).data.user.ownKeys, undefined);
  r = await s1.del('/api/me/keys/' + (await s1.get('/api/me/keys')).data.keys[0].id);
  assert.equal(r.data.keys.length, 0);
  await new Promise((r) => setTimeout(r, 300)); const n3 = used.length; await s1.post('/api/buddy/chat', { message: 'hi again' });
  assert.ok(used.slice(n3).every((k) => !k.startsWith('STUDENT-OWN')), 'after removal the shared pool is used again');
});
