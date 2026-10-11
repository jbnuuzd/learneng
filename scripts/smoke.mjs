// Post-deploy smoke test against a running Worker (wrangler dev or the deployed URL).
//   node scripts/smoke.mjs http://localhost:8787
//   TEACHER_SIGNUP_CODE=xxxx node scripts/smoke.mjs https://learneng.<you>.workers.dev
const base = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const run = Date.now().toString(36);
let failed = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) failed++; };

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie: this.cookie, 'x-local-date': today, ...headers }, body: body === undefined ? undefined : (typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body)) });
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : new Uint8Array(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get(u) { return this.req('GET', u); } post(u, b = {}) { return this.req('POST', u, b); }
}

const teacher = new Client(), student = new Client();
let r = await teacher.post('/api/auth/register', { name: 'Smoke Teacher', email: `t-${run}@example.com`, password: 'smoketest123', role: 'teacher', teacherSignupCode: process.env.TEACHER_SIGNUP_CODE || '' });
ok(r.status === 200, `teacher register (${r.status}${r.data.error ? ' ' + r.data.error : ''})`);
if (r.status !== 200) { console.log('Teacher kodi kerak bo\'lsa: TEACHER_SIGNUP_CODE=... node scripts/smoke.mjs <url>'); process.exit(1); }
const code = r.data.user.inviteCode;
r = await student.post('/api/auth/register', { name: 'Smoke Student', email: `s-${run}@example.com`, password: 'smoketest123', inviteCode: code });
ok(r.status === 200 && r.data.user.teacher, 'student register + teacher link (PBKDF2, D1)');
ok(r.data.ai === true || r.data.ai === false, `AI status reported: ${r.data.ai ? 'Gemini ulangan' : 'AI ulanmagan'}`);

r = await student.get('/api/diagnostic');
const c = r.data.content;
ok(c?.grammar?.items?.length >= 30, `diagnostic content (${c?.grammar?.items?.length} grammar items)`);
const first = (n) => Array(n).fill(0);
await student.post('/api/diagnostic/section/grammar', { answers: first(c.grammar.items.length) });
await student.post('/api/diagnostic/section/vocab', { answers: first(c.vocab.items.length) });
await student.post('/api/diagnostic/section/reading', { answers: c.reading.passages.map((p) => first(p.items.length)) });
await student.post('/api/diagnostic/section/listening', { answers: c.listening.clips.map((p) => first(p.items.length)) });
const essay = 'I think learning languages early is useful because children learn fast and they enjoy games and songs a lot. '.repeat(4);
r = await student.post('/api/diagnostic/section/writing', { texts: [essay, essay] });
ok(r.status === 200, `writing graded (${r.data.summary?.ai ? 'AI' : 'offline'})`);
r = await student.post('/api/diagnostic/finish');
ok(r.status === 200 && r.data.overall?.cefr, `diagnostic result: ${r.data.overall?.cefr} / IELTS ${r.data.overall?.ielts}`);

r = await student.post('/api/goal', { targetCefr: 'C1', months: 3, hoursPerDay: 3 });
ok(r.status === 200 && r.data.plan.tasks > 100, `goal + plan created (${r.data.plan?.tasks} tasks, atomic D1 batch)`);
const day = (await student.get('/api/plan/day')).data;
ok(day.tasks.length >= 2 && day.newWords >= 50, `today: ${day.tasks.length} tasks, ${day.newWords} new words`);
const vocab = day.tasks.find((t) => t.type === 'vocab');
const les = (await student.get('/api/tasks/' + vocab.id)).data;
const words = les.stages.filter((s) => s.type === 'flash').reduce((n, s) => n + s.words.length, 0);
ok(words >= 50, `vocabulary lesson has ${words} words`);
const audio = les.stages[0].words[0].audio;
r = await student.get('/api/tts/' + audio);
ok(r.status === 200, `TTS endpoint (${r.headers.get('content-type')?.split(';')[0]})`);
r = await student.post(`/api/tasks/${vocab.id}/stage/flash-topic`, {});
ok(r.status === 200, 'flashcard stage saved');
await student.post(`/api/tasks/${vocab.id}/stage/flash-general`, {});
const quiz = les.stages.find((x) => x.key === 'vquiz');
r = await student.post(`/api/tasks/${vocab.id}/stage/vquiz`, { answers: quiz.items.map(() => 0) });
ok(r.status === 200 && r.data.items.length === quiz.items.length, 'vocabulary quiz graded + spaced-repetition state updated (D1 UPDATE…FROM)');
r = await student.get('/api/progress');
ok(r.data.srs?.total >= 50, `SRS tracks ${r.data.srs?.total} learned words`);
const grammar = day.tasks.find((t) => t.type === 'grammar');
if (grammar) { const g = (await student.get('/api/tasks/' + grammar.id)).data; r = await student.post(`/api/tasks/${grammar.id}/stage/theory`, {}); ok(r.status === 200, `grammar lesson "${grammar.title}" (${g.stages.length} stages)`); }

r = await student.post('/api/trainers/reading/new', { mode: 'generate' });
ok(r.status === 200 && r.data.items?.length >= 3, `reading trainer (${r.data.generated ? 'AI' : 'tayyor matn'})`);
r = await student.post('/api/speaking/start', { persona: 'emma', mode: 'free' });
ok(r.status === 200, 'speaking partner session');
r = await student.get('/api/analysis');
ok(r.status === 200 && r.data.ready, `analysis: ${r.data.verdict}, chance ${r.data.chance}%`);

r = await student.post('/api/mock/start', { kind: 'mini' });
ok(r.status === 200 && r.data.id, 'IELTS mock exam created');
r = await student.post(`/api/mock/${r.data.id}/section/reading/start`);
ok(r.status === 200 && r.data.passages?.length === 2 && r.data.remainingSeconds > 0, 'mock reading section started with timer');
r = await teacher.get('/api/teacher/export.csv');
ok(r.status === 200 && r.headers.get('content-type')?.includes('text/csv'), 'teacher CSV export');
const file = new TextEncoder().encode('%PDF-1.4 smoke');
r = await teacher.req('POST', `/api/teacher/materials?title=Smoke`, file, { 'x-filename': 'smoke.pdf', 'content-type': 'application/octet-stream', 'x-requested-with': 'smoke' });
ok(r.status === 200, `material upload to R2 (${r.status})`);
if (r.status === 200) {
  const id = r.data.id;
  r = await student.get(`/api/materials/${id}/download`);
  ok(r.status === 200 && new TextDecoder().decode(r.data).startsWith('%PDF'), 'material download from R2');
  await teacher.req('DELETE', '/api/teacher/materials/' + id);
}
const list = (await teacher.get('/api/teacher/students')).data;
ok(list.students?.length === 1, 'teacher sees the student');
console.log(failed ? `\n${failed} ta tekshiruv muvaffaqiyatsiz` : '\nHammasi joyida ✅');
process.exit(failed ? 1 : 0);
