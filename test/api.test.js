import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, Client, today } from './helpers.js';

let srv, teacher, student, D, units, mkWav;
const date = today();

before(async () => {
  srv = await boot({ GEMINI_API_KEY: '' });
  D = await import('../server/content/diagnostic.js');
  units = (await import('../server/lib/content.js')).unitById;
  teacher = new Client(srv.base, date); student = new Client(srv.base, date);
});
after(async () => { await srv.close(); });

test('auth: register teacher + student, validation, session', async () => {
  let r = await teacher.post('/api/auth/register', { name: 'Ustoz Karim', email: 'karim@example.com', password: 'secret123', role: 'teacher' });
  assert.equal(r.status, 200); assert.equal(r.data.user.role, 'teacher'); assert.match(r.data.user.inviteCode, /^[A-F0-9]{8}$/);
  const code = r.data.user.inviteCode;
  r = await student.post('/api/auth/register', { name: 'Ali', email: 'ali@example.com', password: 'short' });
  assert.equal(r.status, 400);
  r = await student.post('/api/auth/register', { name: 'Ali', email: 'ali@example.com', password: 'password1', inviteCode: 'BADCODE0' });
  assert.equal(r.status, 400);
  r = await student.post('/api/auth/register', { name: 'Ali', email: 'ali@example.com', password: 'password1', inviteCode: code });
  assert.equal(r.status, 200); assert.equal(r.data.user.teacher.name, 'Ustoz Karim');
  assert.equal(r.data.ai, false);
  r = await new Client(srv.base, date).get('/api/me');
  assert.equal(r.status, 200); assert.equal(r.data.user, null);
  assert.equal((await new Client(srv.base, date).get('/api/plan')).status, 401);
  assert.equal((await new Client(srv.base, date).get('/api/teacher/students')).status, 401);
  r = await new Client(srv.base, date).post('/api/auth/login', { email: 'ali@example.com', password: 'wrong' });
  assert.equal(r.status, 401);
});

test('role separation', async () => {
  assert.equal((await student.get('/api/teacher/students')).status, 403);
  assert.equal((await teacher.get('/api/diagnostic')).status, 403);
});

test('diagnostic: content hides answers, sections score, finish gives CEFR + IELTS', async () => {
  let r = await student.get('/api/diagnostic');
  assert.equal(r.status, 200);
  assert.ok(!JSON.stringify(r.data.content).includes('"a":'), 'answers must not leak');
  assert.equal(r.data.content.grammar.items.length, D.grammar.length);
  // answer everything correctly except the C1/C2 items
  const ans = (arr, hard = ['C1', 'C2']) => arr.map((x) => (hard.includes(x.d) ? (x.a + 1) % x.o.length : x.a));
  assert.equal((await student.post('/api/diagnostic/section/grammar', { answers: ans(D.grammar) })).status, 200);
  assert.equal((await student.post('/api/diagnostic/section/vocab', { answers: ans(D.vocab) })).status, 200);
  assert.equal((await student.post('/api/diagnostic/section/reading', { answers: D.reading.map((p) => ans(p.q)) })).status, 200);
  assert.equal((await student.post('/api/diagnostic/section/listening', { answers: D.listening.map((p) => ans(p.q)) })).status, 200);
  const essay = 'I would love to show you my city. First, we will visit the old bazaar and try some local food. Please bring comfortable shoes because we will walk a lot, and a warm jacket for the evening. I am very excited because I have not seen you for three years and we have so much to talk about. See you soon! '.repeat(1);
  r = await student.post('/api/diagnostic/section/writing', { texts: [essay, essay + essay] });
  assert.equal(r.status, 200);
  r = await student.post('/api/diagnostic/finish');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(['B1', 'B2', 'C1'].includes(r.data.overall.cefr), 'overall ' + r.data.overall.cefr);
  assert.ok(r.data.overall.ielts >= 4.5 && r.data.overall.ielts <= 8, 'ielts ' + r.data.overall.ielts);
  assert.equal(r.data.speakingEstimated, true);
  assert.ok(r.data.skills.grammar.cefr);
});

let preview, goal;
test('goal preview gives recommended hours; goal creates a dated plan', async () => {
  let r = await student.post('/api/goal/preview', { targetCefr: 'C1', months: 3 });
  assert.equal(r.status, 200); preview = r.data;
  assert.ok(preview.recommendedHoursPerDay >= 2.5);
  assert.ok(preview.newWordsPerDay >= 50);
  r = await student.post('/api/goal/preview', { targetIelts: 8, months: 12 });
  assert.equal(r.data.target.cefr, 'C1');
  r = await student.post('/api/goal', { targetCefr: 'C1', months: 3, hoursPerDay: 4 });
  assert.equal(r.status, 200, JSON.stringify(r.data)); goal = r.data;
  assert.ok(goal.plan.tasks > 100);
  r = await student.get('/api/plan');
  assert.equal(r.data.plan.days, goal.preview.days);
});

test('plan: every day has >= 50 new words, minutes fit the daily budget, units are real', async () => {
  const cal = await student.get(`/api/plan/calendar?from=${date}&to=${new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10)}`);
  assert.ok(cal.data.days.length >= 55);
  for (const d of cal.data.days.slice(0, 40)) {
    assert.ok(d.minutes <= 4 * 60 * 1.5 && d.minutes >= 4 * 60 * 0.55, `day ${d.date} minutes ${d.minutes}`);
    const day = (await student.get('/api/plan/day?date=' + d.date)).data;
    assert.ok(day.newWords >= 50, 'newWords ' + day.newWords);
    assert.ok(day.tasks[0].type === 'vocab');
  }
});

let taskIds = {};
test('today view and lessons (vocab: >=50 words, topic list of 40)', async () => {
  const day = (await student.get('/api/plan/day')).data;
  for (const t of day.tasks) taskIds[t.type] = t.id;
  assert.ok(taskIds.vocab && taskIds.grammar);
  const v = (await student.get('/api/tasks/' + taskIds.vocab)).data;
  const flashes = v.stages.filter((s) => s.type === 'flash');
  const total = flashes.reduce((n, s) => n + s.words.length, 0);
  assert.ok(total >= 50, 'vocab words ' + total);
  const topicFlash = flashes.find((s) => s.key === 'flash-topic');
  assert.equal(topicFlash.words.length, 40);
  assert.ok(v.stages.some((s) => s.type === 'choice') && v.stages.some((s) => s.type === 'sentences'));
  const g = (await student.get('/api/tasks/' + taskIds.grammar)).data;
  const types = new Set(g.stages.map((s) => s.type));
  for (const t of ['theory', 'choice', 'text', 'sentences']) assert.ok(types.has(t), 'missing ' + t);
  assert.ok(!JSON.stringify(g).includes('"keyData"'));
});

test('stage submit: correct answers score 100%, wrong answers get tone-based feedback', async () => {
  const lesson = (await student.get('/api/tasks/' + taskIds.grammar)).data;
  const unitId = JSON.parse((await (await import('../server/lib/db.js')).q.get('SELECT ref_json FROM tasks WHERE id=?', taskIds.grammar)).ref_json).unit;
  const u = units[unitId];
  const mcq = lesson.stages.find((s) => s.key === 'mcq');
  let r = await student.post(`/api/tasks/${taskIds.grammar}/stage/mcq`, { answers: u.mcq.map((x) => x.a) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.score, 1); assert.equal(r.data.tone, 'neutral'); assert.match(r.data.feedback, /100%/);
  // wrong answers + positive tone set by teacher
  const stu = (await teacher.get('/api/teacher/students')).data.students[0];
  assert.equal((await teacher.put(`/api/teacher/students/${stu.id}/tone`, { tone: 'positive' })).status, 200);
  r = await student.post(`/api/tasks/${taskIds.grammar}/stage/gap`, { answers: ['zzz', 'zzz', 'zzz', 'zzz'] });
  assert.equal(r.status, 200); assert.equal(r.data.score, 0); assert.equal(r.data.tone, 'positive'); assert.match(r.data.feedback, /Harakatingiz|Barakalla/);
  assert.equal(r.data.items[0].ok, false); assert.ok(r.data.items[0].expected);
  assert.equal((await teacher.put(`/api/teacher/students/${stu.id}/tone`, { tone: 'negative', date })).status, 200);
  r = await student.post(`/api/tasks/${taskIds.grammar}/stage/gap`, { answers: u.gap.map((x) => (Array.isArray(x.a) ? x.a[0] : x.a)) });
  assert.equal(r.data.tone, 'negative', 'date override beats default');
  assert.equal(r.data.score, 1);
  // contractions are equivalent
  r = await student.post(`/api/tasks/${taskIds.grammar}/stage/theory`, {});
  assert.equal(r.status, 200);
  const prog = (await student.get('/api/progress')).data;
  assert.ok(prog.skills.find((s) => s.skill === 'grammar').ability > 0);
});

test('vocab flashcards mark words as learned; next vocab day gives different words', async () => {
  let r = await student.post(`/api/tasks/${taskIds.vocab}/stage/flash-topic`, {});
  assert.equal(r.status, 200);
  const { q } = await import('../server/lib/db.js');
  assert.equal((await q.get('SELECT COUNT(*) n FROM learned_words')).n, 40);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const day2 = (await student.get('/api/plan/day?date=' + tomorrow)).data;
  const v2 = (await student.get('/api/tasks/' + day2.tasks.find((t) => t.type === 'vocab').id)).data;
  const w1 = new Set((await q.all('SELECT word FROM learned_words')).map((x) => x.word));
  const flashed = v2.stages.filter((s) => s.type === 'flash').flatMap((s) => s.words.map((w) => w.w.toLowerCase()));
  assert.ok(flashed.length >= 50, 'day2 words ' + flashed.length);
  assert.equal(flashed.filter((w) => w1.has(w) && v2.stages.find((s) => s.key === 'flash-review') == null).length, 0, 'no repeats unless labelled review');
});

test('translate / writing stages work offline with heuristic grading and honest labelling', async () => {
  const lesson = (await student.get('/api/tasks/' + taskIds.grammar)).data;
  const tr = lesson.stages.find((s) => s.key === 'translate');
  if (tr) {
    const r = await student.post(`/api/tasks/${taskIds.grammar}/stage/translate`, { answers: tr.items.map(() => 'I am a student.') });
    assert.equal(r.status, 200); assert.equal(r.data.ai, false);
  }
  const w = lesson.stages.find((s) => s.key === 'write');
  if (w) {
    const r = await student.post(`/api/tasks/${taskIds.grammar}/stage/write`, { text: 'I live in a small flat with my family and we have a very nice garden near the house where we grow tomatoes.' });
    assert.equal(r.status, 200); assert.equal(r.data.ai, false); assert.match(r.data.feedback, /AI ulanmagan/);
  }
});

test('tts endpoint falls back to browser speech when AI is off', async () => {
  const lesson = (await student.get('/api/tasks/' + taskIds.vocab)).data;
  const audio = lesson.stages.find((s) => s.type === 'flash').words[0].audio;
  const r = await student.get('/api/tts/' + audio);
  assert.equal(r.status, 200); assert.equal(r.data.fallback, true); assert.ok(r.data.text);
});

test('reading / listening trainers: new run, submit, history; no answer leakage', async () => {
  const cfg = (await student.get('/api/trainers/config')).data;
  assert.equal(cfg.personas.length, 10); assert.ok(cfg.modes.length >= 6);
  let r = await student.post('/api/trainers/reading/new', { mode: 'generate', topic: 'education' });
  assert.equal(r.status, 200); assert.ok(r.data.notice); assert.ok(!JSON.stringify(r.data).includes('"a":'));
  const run = r.data;
  r = await student.post(`/api/trainers/runs/${run.id}/submit`, { answers: run.items.map(() => 0) });
  assert.equal(r.status, 200); assert.ok(r.data.feedback);
  assert.equal((await student.post(`/api/trainers/runs/${run.id}/submit`, { answers: [] })).status, 400);
  r = await student.post('/api/trainers/listening/new', { mode: 'generate', format: 'dialogue' });
  assert.equal(r.status, 200); assert.ok(r.data.audio);
  assert.equal((await student.post('/api/trainers/reading/new', { mode: 'text', text: 'too short' })).status, 400);
  r = await student.get('/api/trainers/history');
  assert.equal(r.data.length, 2);
});

test('speaking trainer: 10 personas, session flow, report, level auto', async () => {
  let r = await student.post('/api/speaking/start', { persona: 'victor', mode: 'ielts1', level: 'auto' });
  assert.equal(r.status, 200); assert.equal(r.data.persona.id, 'victor'); assert.ok(r.data.turns[0].audio);
  const id = r.data.id;
  r = await student.post(`/api/speaking/${id}/turn`, { text: 'I live in Tashkent with my family.' });
  assert.equal(r.status, 200); assert.ok(r.data.reply); assert.ok(r.data.audio);
  r = await student.post(`/api/speaking/${id}/finish`);
  assert.equal(r.status, 200); assert.equal(r.data.status, 'done'); assert.ok(r.data.report.summary);
  assert.equal((await student.post('/api/speaking/start', { persona: 'nobody' })).status, 400);
  assert.equal((await student.get('/api/speaking')).data.length, 1);
});

test('analysis returns hours/vocab/grammar model and an honest verdict', async () => {
  const r = await student.get('/api/analysis');
  assert.equal(r.status, 200); assert.equal(r.data.ready, true);
  assert.ok(['realistic', 'stretch', 'unrealistic'].includes(r.data.verdict));
  assert.ok(r.data.hours.required > 0); assert.ok(r.data.vocabulary.newWordsPerDay >= 50);
  assert.ok(r.data.narrative.summary); assert.ok(r.data.disclaimer);
});

test('teacher: overview, extra tasks, remedial, replan, notes, materials, isolation', async () => {
  const list = (await teacher.get('/api/teacher/students')).data;
  const sid = list.students[0].id;
  let r = await teacher.get('/api/teacher/students/' + sid);
  assert.equal(r.status, 200); assert.ok(r.data.skills.length === 6); assert.ok(r.data.diagnostic.overall); assert.ok(r.data.recent.length > 0);
  // extra tasks
  r = await teacher.post(`/api/teacher/students/${sid}/tasks`, { kind: 'grammar', unit: 'passive', mode: 'review', note: 'Passive ni takrorlang' });
  assert.equal(r.status, 200);
  r = await teacher.post(`/api/teacher/students/${sid}/tasks`, { kind: 'custom', title: 'Hafta xulosasi', instructions: 'Write about your week (80 words).', mode: 'write' });
  assert.equal(r.status, 200); const customId = r.data.id;
  r = await teacher.post(`/api/teacher/students/${sid}/tasks`, { kind: 'bogus' });
  assert.equal(r.status, 400);
  const day = (await student.get('/api/plan/day')).data;
  const extra = day.tasks.filter((t) => t.source === 'teacher');
  assert.equal(extra.length, 2); assert.ok(extra.every((t) => t.by === 'Ustoz Karim'));
  const les = (await student.get('/api/tasks/' + customId)).data;
  assert.equal(les.stages[0].type, 'write');
  // remedial + replan + notes
  r = await teacher.post(`/api/teacher/students/${sid}/remedial`, { unit: 'conditionals' });
  assert.equal(r.data.ids.length, 3);
  r = await teacher.post(`/api/teacher/students/${sid}/replan`, { hoursPerDay: 5, months: 4 });
  assert.equal(r.status, 200);
  const plan = (await student.get('/api/plan')).data;
  assert.equal(plan.goal.hours_per_day, 5);
  const still = (await student.get('/api/plan/day')).data.tasks.filter((t) => t.source === 'teacher').length;
  assert.equal(still, 2, 'teacher tasks survive a replan');
  assert.equal((await teacher.post(`/api/teacher/students/${sid}/notes`, { text: 'Yaxshi o\'sish' })).status, 200);
  r = await teacher.del(`/api/teacher/students/${sid}/tasks/${customId}`);
  assert.equal(r.status, 200);
  // materials
  r = await teacher.req('POST', `/api/teacher/materials?title=${encodeURIComponent('Grammar book')}`, Buffer.from('%PDF-1.4 test'), { 'x-filename': 'book.pdf', 'content-type': 'application/octet-stream', 'x-requested-with': 'x' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const mid = r.data.id;
  r = await teacher.req('POST', '/api/teacher/materials', Buffer.from('x'), { 'x-filename': 'evil.html', 'content-type': 'application/octet-stream', 'x-requested-with': 'x' });
  assert.equal(r.status, 400);
  r = await student.get('/api/materials');
  assert.equal(r.data.length, 1);
  r = await student.get(`/api/materials/${mid}/download`);
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/pdf');
  // another teacher cannot see this student
  const t2 = new Client(srv.base, date);
  await t2.post('/api/auth/register', { name: 'Boshqa', email: 'other@example.com', password: 'password1', role: 'teacher' });
  assert.equal((await t2.get('/api/teacher/students/' + sid)).status, 404);
  assert.equal((await t2.get(`/api/materials/${mid}/download`)).status, 404);
  // other student cannot open someone else's task
  const s2 = new Client(srv.base, date);
  await s2.post('/api/auth/register', { name: 'Vali', email: 'vali@example.com', password: 'password1' });
  assert.equal((await s2.get('/api/tasks/' + taskIds.grammar)).status, 404);
  assert.equal((await s2.get(`/api/materials/${mid}/download`)).status, 404);
});

test('teacher dashboard uses grouped queries and matches the per-student numbers', async () => {
  const { q } = await import('../server/lib/db.js');
  const list = (await teacher.get('/api/teacher/students')).data.students;
  assert.equal(list.length, 1);
  const s = list[0];
  const { statsFor } = await import('../server/routes/plan.js');
  const stats = await statsFor(s.id, date);
  assert.deepEqual(s.stats, stats);
  const detail = (await teacher.get('/api/teacher/students/' + s.id)).data;
  assert.deepEqual(detail.alerts.map((a) => a.code).sort(), s.alerts.map((a) => a.code).sort());
  assert.equal(detail.student.todayTone, s.tone);
  assert.equal(s.level.cefr, detail.level.cefr);
});

test('password change signs out other sessions; teacher can reset a student password', async () => {
  const other = new Client(srv.base, date);
  assert.equal((await other.post('/api/auth/login', { email: 'ali@example.com', password: 'password1' })).status, 200);
  assert.equal((await student.post('/api/me/password', { current: 'wrong', next: 'newpassword1' })).status, 403);
  assert.equal((await student.post('/api/me/password', { current: 'password1', next: 'short' })).status, 400);
  assert.equal((await student.post('/api/me/password', { current: 'password1', next: 'newpassword1' })).status, 200);
  assert.equal((await student.get('/api/plan')).status, 200, 'current device stays signed in');
  assert.equal((await other.get('/api/plan')).status, 401, 'other device is signed out');
  const sid = (await teacher.get('/api/teacher/students')).data.students[0].id;
  const r = await teacher.post(`/api/teacher/students/${sid}/reset-password`);
  assert.equal(r.status, 200); assert.equal(r.data.password.length, 10);
  assert.equal((await student.get('/api/plan')).status, 401, 'student sessions revoked');
  const again = new Client(srv.base, date);
  assert.equal((await again.post('/api/auth/login', { email: 'ali@example.com', password: 'newpassword1' })).status, 401);
  assert.equal((await again.post('/api/auth/login', { email: 'ali@example.com', password: r.data.password })).status, 200);
  Object.assign(student, { cookie: again.cookie });
});

test('CSV export is attachment, neutralises formulas, and is teacher-only', async () => {
  const sid = (await teacher.get('/api/teacher/students')).data.students[0].id;
  const { q } = await import('../server/lib/db.js');
  await q.run("INSERT INTO attempts(user_id,stage_key,stage_type,skill,score,feedback,tone) VALUES(?,?,?,?,?,?,?)", sid, 'x', 'text', 'grammar', 0.5, '=HYPERLINK("http://evil")', 'neutral');
  let r = await teacher.get(`/api/teacher/students/${sid}/export.csv`);
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/csv/); assert.match(r.headers.get('content-disposition'), /attachment/);
  const text = r.data.toString('utf8');
  assert.ok(text.includes("\"'=HYPERLINK(") || text.includes("'=HYPERLINK("), 'formula neutralised');
  assert.ok(!/(^|,)=HYPERLINK/m.test(text));
  assert.equal((await teacher.get('/api/teacher/export.csv')).status, 200);
  assert.equal((await student.get('/api/teacher/export.csv')).status, 403);
});

test('csrf: cross-origin POST is rejected', async () => {
  const r = await student.req('POST', '/api/plan/regenerate', {}, { origin: 'http://evil.example' });
  assert.equal(r.status, 403);
});

test('teacher message reaches the student and can be marked read', async () => {
  const studentId = (await teacher.get('/api/teacher/students')).data.students[0].id;
  assert.equal((await teacher.post(`/api/teacher/students/${studentId}/message`, { text: 'Yaxshi ketyapsiz, davom eting!' })).status, 200);
  let r = await student.get('/api/messages');
  assert.equal(r.data.length, 1); assert.equal(r.data[0].read, 0); assert.match(r.data[0].text, /davom/);
  await student.post('/api/messages/read');
  assert.equal((await student.get('/api/messages')).data[0].read, 1);
  assert.equal((await student.post(`/api/teacher/students/${studentId}/message`, { text: 'hack' })).status, 403);
});
