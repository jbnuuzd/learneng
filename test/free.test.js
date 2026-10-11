// Free-plan mode: no R2 bucket bound. Uploads go to D1 chunks, TTS falls back to browser speech.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, Client, today } from './helpers.js';

let srv, teacher, student;
before(async () => {
  srv = await boot({ FILES: null, PBKDF2_ITERATIONS: '20000' });
  teacher = new Client(srv.base, today()); student = new Client(srv.base, today());
  const t = await teacher.post('/api/auth/register', { name: 'Teach', email: 'f@x.com', password: 'password1', role: 'teacher' });
  await student.post('/api/auth/register', { name: 'Stud', email: 'g@x.com', password: 'password1', inviteCode: t.data.user.inviteCode });
});
after(async () => { await srv.close(); });

test('login still verifies hashes made with a custom iteration count', async () => {
  const c = new Client(srv.base, today());
  assert.equal((await c.post('/api/auth/login', { email: 'f@x.com', password: 'password1' })).status, 200);
  assert.equal((await c.post('/api/auth/login', { email: 'f@x.com', password: 'nope' })).status, 401);
});

test('materials round-trip through D1 chunks (multi-chunk file) and respect the 8 MB limit', async () => {
  const big = new Uint8Array(1_500_000).map((_, i) => (i * 7) % 251);
  let r = await teacher.req('POST', '/api/teacher/materials?title=Big', Buffer.from(big), { 'x-filename': 'big.pdf', 'content-type': 'application/octet-stream', 'x-requested-with': 'x' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const id = r.data.id;
  r = await student.get(`/api/materials/${id}/download`);
  assert.equal(r.status, 200); assert.equal(r.data.length, big.length); assert.ok(Buffer.from(big).equals(r.data), 'bytes identical');
  r = await teacher.req('POST', '/api/teacher/materials', Buffer.alloc(9 * 1024 * 1024, 1), { 'x-filename': 'huge.pdf', 'content-type': 'application/octet-stream', 'x-requested-with': 'x' });
  assert.equal(r.status, 413);
  r = await teacher.del('/api/teacher/materials/' + id);
  assert.equal(r.status, 200);
  assert.equal((await student.get(`/api/materials/${id}/download`)).status, 404);
});
