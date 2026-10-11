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
      if (k === 'KEY-ONE-EXHAUSTED-0001') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } })); }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }));
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
  r = await teacher.post('/api/ai/keys', { key: 'UI-KEY-FOUR-ABCDEFGHIJKLMN', label: 'Ali' });
  assert.equal(r.data.added, 1);
  const ui = r.data.keys.find((k) => k.source === 'ui');
  assert.equal(ui.key, '…KLMN'); assert.ok(ui.id); assert.ok(!JSON.stringify(r.data).includes('UI-KEY-FOUR'), 'full key never returned');
  assert.equal((await teacher.post('/api/ai/keys', { key: 'UI-KEY-FOUR-ABCDEFGHIJKLMN' })).data.added, 0, 'duplicate ignored');
  r = await teacher.del('/api/ai/keys/' + ui.id);
  assert.equal(r.data.keys.filter((k) => k.source === 'ui').length, 0);
});
