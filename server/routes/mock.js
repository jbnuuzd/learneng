// Timed IELTS-style mock exam: Listening, Reading, Writing (letter + essay), Speaking (3 parts).
import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { rateLimit } from '../lib/auth.js';
import { aiEnabled } from '../lib/gemini.js';
import { gradeWriting, gradeSpeaking } from '../lib/ai.js';
import { gradeObjective, wordCount } from '../lib/grading.js';
import { readingFor, listeningFor, promptFor } from '../lib/content.js';
import { letterTasks, mockSpeaking } from '../content/pools.js';
import { rawToBand, overallBand, writingBand, roundBand, SECTION_PLAN, SECTION_ORDER } from '../lib/ielts.js';
import { toIelts, ieltsToAbility, cefrToAbility, LEVELS, levelIndex } from '../lib/scale.js';
import { achievedCefr, applyEvidence, overall, abilities } from '../lib/progress.js';
import { scriptAudio } from '../lessons.js';

const THEMES = ['education', 'environment', 'technology', 'health', 'work', 'society'];
const GRACE = 90;                                   // seconds of tolerance for slow uploads before a section counts as late
const SEC_UZ = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' };

async function loadMock(userId, id) {
  const row = await q.get('SELECT * FROM mock_tests WHERE id=? AND user_id=?', Number(id), userId);
  if (!row) throw new HttpError(404, 'Mock test topilmadi');
  return { row, content: unj(row.content_json, {}), sections: unj(row.sections_json, {}) };
}
const save = (row, content, sections) => q.run('UPDATE mock_tests SET content_json=?, sections_json=? WHERE id=?', j(content), j(sections), row.id);

async function buildSection(name, row) {
  const plan = SECTION_PLAN[row.kind][name];
  const level = row.level;
  if (name === 'listening') {
    const clips = [];
    for (let i = 0; i < plan.clips; i++) clips.push(await listeningFor(`mock:${row.id}:l${i}`, { level, topic: THEMES[(row.id + i) % THEMES.length], format: i % 2 ? 'monologue' : 'dialogue' }, `${row.id}:l${i}`));
    return clips;
  }
  if (name === 'reading') {
    const ps = [];
    for (let i = 0; i < plan.passages; i++) ps.push(await readingFor(`mock:${row.id}:r${i}`, { level, topic: THEMES[(row.id + i + 2) % THEMES.length] }, `${row.id}:r${i}`));
    return ps;
  }
  if (name === 'writing') {
    const near = letterTasks.filter((l) => Math.abs(levelIndex(l.level) - levelIndex(level)) <= 1);
    const t1 = (near.length ? near : letterTasks)[row.id % (near.length || letterTasks.length)];
    const t2 = await promptFor(`mock:${row.id}:w2`, 'writing', { level, topic: THEMES[row.id % THEMES.length] }, row.id);
    return { t1: { prompt: t1.prompt, words: [150, 200] }, t2: { prompt: t2.prompt, words: [250, 320] } };
  }
  const p2 = mockSpeaking.part2[row.id % mockSpeaking.part2.length];
  return { p1: mockSpeaking.part1[row.id % mockSpeaking.part1.length][0], p2: p2.cue, p3: mockSpeaking.part3[p2.theme] || mockSpeaking.part3.technology };
}

function publicSection(name, c) {
  if (name === 'listening') return { clips: c.map((x, i) => ({ title: `Part ${i + 1}`, audio: scriptAudio(x.lines, x.speakers), items: x.q.map((y) => ({ q: y.q, o: y.o })) })) };
  if (name === 'reading') return { passages: c.map((x) => ({ title: x.title, text: x.text, items: x.q.map((y) => ({ q: y.q, o: y.o })) })) };
  if (name === 'writing') return { tasks: [{ title: 'Task 1 (≈ 20 daqiqa)', ...c.t1 }, { title: 'Task 2 (≈ 40 daqiqa)', ...c.t2 }] };
  return { parts: [{ part: 1, title: 'Part 1 — tanishuv', prompt: c.p1, seconds: 60 }, { part: 2, title: 'Part 2 — monolog (1 daqiqa tayyorgarlik, 1–2 daqiqa gapirish)', prompt: c.p2, seconds: 120, prep: 60 }, { part: 3, title: 'Part 3 — muhokama', prompt: c.p3, seconds: 90 }] };
}

const needAudioNotice = () => (aiEnabled() ? null : "AI ulanmagan: Writing va Speaking haqiqiy baholanmaydi, listening audio brauzer ovozi bilan o'qiladi.");

function recommendations(bands, target, late) {
  const out = [];
  const tips = {
    listening: "Listening: har kuni 15–20 daqiqa diktant va audio trenajyor; javoblarni eshitish paytida yozishga o'rganing, imlo va raqamlarga e'tibor bering.",
    reading: "Reading: vaqtni boshqarish (1 matn ≈ 20 daqiqa), skimming/scanning va True/False/Not Given savollari bo'yicha mashq qiling.",
    writing: "Writing: Task 2 ni tuzilma bilan yozing (kirish — 2 asosiy fikr — xulosa), har kuni 1 ta paragraf; AI tuzatishlari ro'yxatidagi xatolarni takrorlamang.",
    speaking: "Speaking: virtual trenajyorda IELTS Part 2 rejimida har kuni 1–2 daqiqalik monolog; javoblarni sabab va misol bilan kengaytiring.",
  };
  const gaps = SECTION_ORDER.filter((s) => bands[s] != null && target && bands[s] < target).sort((a, b) => bands[a] - bands[b]);
  for (const s of gaps.slice(0, 3)) out.push(`${tips[s]} (hozir ${bands[s]}, maqsad ${target})`);
  if (late.length) out.push(`Vaqt: ${late.map((s) => SEC_UZ[s]).join(', ')} bo'limida vaqtdan oshdingiz. Imtihonda bu mumkin emas: taymer bilan mashq qiling.`);
  if (!out.length) out.push("Barcha ko'nikmalar maqsad bandiga yetgan. Imtihon formatiga o'rganish uchun yana 2–3 ta mock test topshiring.");
  return out;
}

export function registerMock(r) {
  const S = { role: 'student', limit: 40 * 1024 * 1024 };

  r.get('/api/mock', async ({ user }) => {
    const rows = await q.all('SELECT id, kind, level, status, result_json, created_at FROM mock_tests WHERE user_id=? ORDER BY id DESC LIMIT 20', user.id);
    const goal = await q.get('SELECT target_ielts, target_cefr FROM goals WHERE user_id=?', user.id);
    return { plans: SECTION_PLAN, goal: goal || null, ai: aiEnabled(), notice: needAudioNotice(),
      history: rows.map((x) => { const res = unj(x.result_json); return { id: x.id, kind: x.kind, status: x.status, created: x.created_at, overall: res?.overall ?? null, bands: res?.bands ?? null }; }) };
  }, S);

  r.post('/api/mock/start', async ({ user, body }) => {
    const kind = body.kind === 'full' ? 'full' : 'mini';
    const open = await q.get("SELECT id FROM mock_tests WHERE user_id=? AND status='open' ORDER BY id DESC LIMIT 1", user.id);
    if (open && !body.force) return { id: open.id, resumed: true };
    if (open) await q.run("UPDATE mock_tests SET status='abandoned' WHERE id=?", open.id);
    const goal = await q.get('SELECT target_cefr FROM goals WHERE user_id=?', user.id);
    const level = LEVELS.includes(goal?.target_cefr) ? goal.target_cefr : await achievedCefr(user.id);
    const id = (await q.run('INSERT INTO mock_tests(user_id,kind,level) VALUES(?,?,?)', user.id, kind, level)).lastInsertRowid;
    return { id, resumed: false };
  }, S);

  r.get('/api/mock/:id', async ({ user, params }) => {
    const { row, sections } = await loadMock(user.id, params.id);
    return { id: row.id, kind: row.kind, level: row.level, status: row.status, plan: SECTION_PLAN[row.kind], order: SECTION_ORDER,
      sections: Object.fromEntries(SECTION_ORDER.map((s) => [s, { started: !!sections[s]?.started, submitted: !!sections[s]?.submitted }])), result: unj(row.result_json), notice: needAudioNotice() };
  }, S);

  r.post('/api/mock/:id/section/:name/start', async ({ user, params }) => {
    const name = params.name;
    if (!SECTION_ORDER.includes(name)) throw bad("Bunday bo'lim yo'q");
    const { row, content, sections } = await loadMock(user.id, params.id);
    if (row.status !== 'open') throw bad('Mock test yakunlangan');
    if (sections[name]?.submitted) throw bad("Bu bo'lim allaqachon topshirilgan");
    if (!content[name]) content[name] = await buildSection(name, row);
    if (!sections[name]) sections[name] = { started: Date.now() };
    await save(row, content, sections);
    const limit = SECTION_PLAN[row.kind][name].minutes * 60;
    return { name, limitSeconds: limit, remainingSeconds: Math.max(0, limit - Math.floor((Date.now() - sections[name].started) / 1000)), ...publicSection(name, content[name]) };
  }, S);

  r.post('/api/mock/:id/section/:name/submit', async ({ user, params, body }) => {
    const name = params.name;
    const { row, content, sections } = await loadMock(user.id, params.id);
    if (row.status !== 'open') throw bad('Mock test yakunlangan');
    const sec = sections[name];
    if (!sec?.started) throw bad("Avval bo'limni boshlang");
    if (sec.submitted) throw bad("Bu bo'lim allaqachon topshirilgan");
    const limit = SECTION_PLAN[row.kind][name].minutes * 60;
    const late = (Date.now() - sec.started) / 1000 > limit + GRACE;
    let result;
    if (name === 'listening' || name === 'reading') {
      const src = content[name];
      const keys = [], answers = [], qs = [];
      src.forEach((c, pi) => c.q.forEach((x, qi) => { keys.push(x.a); answers.push(body.answers?.[pi]?.[qi]); qs.push(x.q); }));
      const g = gradeObjective('choice', keys, answers, qs);
      result = { correct: g.correct, total: g.total, band: rawToBand(g.correct, g.total) };
    } else if (name === 'writing') {
      const tasks = [['t1', content.writing.t1], ['t2', content.writing.t2]];
      const outs = [];
      for (let i = 0; i < 2; i++) {
        const text = String(body.texts?.[i] || '').slice(0, 8000);
        if (wordCount(text) < 5) { outs.push({ band: null, words: wordCount(text), feedback: 'Matn yozilmagan.' }); continue; }
        rateLimit(user.id, 'ai', 40);
        const w = await gradeWriting({ prompt: tasks[i][1].prompt, text, words: tasks[i][1].words, level: row.level, tone: 'neutral' });
        outs.push({ band: w.band ?? roundBand(toIelts(w.ability)), estimated: !w.ai, words: wordCount(text), criteria: w.criteria, strengths: w.strengths, weaknesses: w.weaknesses, corrections: w.corrections, feedback: w.feedback, underLength: wordCount(text) < tasks[i][1].words[0] * 0.9 });
      }
      result = { tasks: outs, band: writingBand(outs[0].band, outs[1].band), estimated: outs.some((o) => o.estimated) };
    } else {
      const prompts = [content.speaking.p1, content.speaking.p2, content.speaking.p3];
      const outs = [];
      for (let i = 0; i < 3; i++) {
        const wav = body.recordings?.[i];
        if (!wav) { outs.push(null); continue; }
        if (typeof wav !== 'string' || wav.length > 8 * 1024 * 1024) throw bad('Audio juda katta');
        rateLimit(user.id, 'ai', 40);
        outs.push(await gradeSpeaking({ prompt: prompts[i], wav, level: row.level, tone: 'neutral' }));
      }
      const graded = outs.filter((o) => o?.ai && o.band != null);
      result = { band: graded.length ? roundBand(graded.reduce((s, o) => s + o.band, 0) / graded.length) : null,
        parts: outs.map((o, i) => o && { part: i + 1, transcript: o.transcript, band: o.band ?? null, criteria: o.criteria, strengths: o.strengths, weaknesses: o.weaknesses, corrections: o.corrections, feedback: o.feedback }), skipped: !outs.some(Boolean) };
    }
    sections[name] = { ...sec, submitted: true, late, result };
    await save(row, content, sections);
    return { ok: true, section: name, late };
  }, S);

  r.post('/api/mock/:id/finish', async ({ user, params, date }) => {
    const { row, sections } = await loadMock(user.id, params.id);
    if (row.status === 'done') return unj(row.result_json);
    const missing = ['listening', 'reading', 'writing'].filter((s) => !sections[s]?.submitted);
    if (missing.length) throw bad(`Topshirilmagan bo'limlar: ${missing.map((s) => SEC_UZ[s]).join(', ')}`);
    const bands = Object.fromEntries(SECTION_ORDER.map((s) => [s, sections[s]?.result?.band ?? null]));
    const present = SECTION_ORDER.filter((s) => bands[s] != null);
    const overallB = overallBand(present.map((s) => bands[s]));
    const goal = await q.get('SELECT target_ielts, target_cefr FROM goals WHERE user_id=?', user.id);
    const target = goal?.target_ielts ?? null;
    const late = SECTION_ORDER.filter((s) => sections[s]?.late);
    const estimated = SECTION_ORDER.filter((s) => sections[s]?.result?.estimated);
    const result = {
      kind: row.kind, bands, overall: overallB, partial: present.length < 4, missingSections: SECTION_ORDER.filter((s) => bands[s] == null),
      estimatedSections: estimated, late, target,
      gap: target != null && overallB != null ? Math.round((target - overallB) * 2) / 2 : null,
      verdict: target == null || overallB == null ? null : overallB >= target ? 'reached' : target - overallB <= 0.5 ? 'close' : 'far',
      perSkillGap: Object.fromEntries(present.map((s) => [s, target != null ? Math.round((target - bands[s]) * 2) / 2 : null])),
      recommendations: recommendations(bands, target, late),
      raw: { listening: sections.listening?.result && { correct: sections.listening.result.correct, total: sections.listening.result.total }, reading: sections.reading?.result && { correct: sections.reading.result.correct, total: sections.reading.result.total } },
      smallSample: ['listening', 'reading'].some((s) => (sections[s]?.result?.total ?? 99) < 20),
      writing: sections.writing?.result?.tasks, speaking: sections.speaking?.result?.parts, finishedAt: new Date().toISOString(),
    };
    for (const s of present) {
      if (estimated.includes(s)) continue;                                  // heuristic bands are not evidence
      await applyEvidence(user.id, s, ieltsToAbility(bands[s]), 0.25, date);
      await q.run('INSERT INTO attempts(user_id,task_id,stage_key,stage_type,skill,topic,score,detail_json,feedback,tone,ai) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        user.id, null, `mock:${row.id}:${s}`, 'mock', s, 'mock', bands[s] / 9, j({ extra: { band: bands[s] } }), `Mock ${row.kind}: ${s} band ${bands[s]}`, 'neutral', s === 'writing' || s === 'speaking' ? 1 : 0);
    }
    await q.run("UPDATE mock_tests SET status='done', result_json=?, finished_at=datetime('now') WHERE id=?", j(result), row.id);
    return result;
  }, S);
}
