import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { aiEnabled } from '../lib/gemini.js';
import { generateReading, generateListening, objectiveFeedback } from '../lib/ai.js';
import { pickReading, pickListening, topicCatalog } from '../lib/content.js';
import { topicNames } from '../content/pools.js';
import { personas, speakingModes } from '../content/personas.js';
import { gradeObjective } from '../lib/grading.js';
import { LEVELS, LEVEL_DIFF, evidenceFromScore } from '../lib/scale.js';
import { achievedCefr, applyEvidence, effectiveTone } from '../lib/progress.js';
import { rateLimit } from '../lib/auth.js';
import { scriptAudio } from '../lessons.js';
import { shuffle } from '../lib/rng.js';

export const RESOURCES = [
  { title: 'BBC Learning English — 6 Minute English', url: 'https://www.bbc.co.uk/learningenglish/english/features/6-minute-english', note: "Transkript sahifada mavjud: matnni nusxalab «Transkript bo'yicha» rejimiga qo'ying — AI savollar tuzadi." },
  { title: 'BBC Learning English — The English We Speak', url: 'https://www.bbc.co.uk/learningenglish/english/features/the-english-we-speak', note: "Qisqa (3 daqiqa) epizodlar — so'zlashuv iboralari." },
  { title: 'BBC Sounds', url: 'https://www.bbc.co.uk/sounds', note: "Podkastlar. Transkript bo'lmasa, audiodan eshitganingizni o'zingiz yozib, AI bilan tekshiring." },
  { title: 'TED Talks (transkript bilan)', url: 'https://www.ted.com/talks', note: "Har bir talkda transkript bor." },
];
const MAX_TEXT = 8000;

async function levelOf(body, userId) {
  const l = String(body.level || '').toUpperCase();
  return LEVELS.includes(l) ? l : await achievedCefr(userId);
}
const topicOf = (body) => String(body.topic || '').trim().slice(0, 80) || null;

function publicRun(row, content) {
  if (row.kind === 'reading') return { id: row.id, kind: 'reading', level: row.level, topic: row.topic, title: content.title, passage: { title: content.title, text: content.text, source: content.source || undefined }, glossary: content.vocabulary, items: content.q.map((x) => ({ q: x.q, o: x.o })), generated: !!content.generated, created: row.created_at };
  return { id: row.id, kind: 'listening', level: row.level, topic: row.topic, title: content.title, audio: scriptAudio(content.lines, content.speakers), items: content.q.map((x) => ({ q: x.q, o: x.o })), generated: !!content.generated, created: row.created_at };
}

export function registerTrainers(r) {
  r.get('/api/trainers/config', async ({ user }) => ({
    level: await achievedCefr(user.id), levels: LEVELS, ai: aiEnabled(),
    topics: [...new Set([...topicNames, ...topicCatalog.map((t) => t.id.split('-')[0])])],
    personas: personas.map(({ id, name, emoji, title, desc }) => ({ id, name, emoji, title, desc })),
    modes: speakingModes, resources: RESOURCES,
  }), { role: 'student' });

  r.post('/api/trainers/reading/new', async ({ user, body }) => {
    const level = await levelOf(body, user.id), topic = topicOf(body);
    const mode = ['generate', 'internet', 'text'].includes(body.mode) ? body.mode : 'generate';
    let content = null, notice = null;
    if (mode === 'text') {
      const text = String(body.text || '').trim().slice(0, MAX_TEXT);
      if (text.split(/\s+/).length < 60) throw bad("Matn juda qisqa (kamida ~60 so'z)");
      if (!aiEnabled()) throw bad("Matn bo'yicha savol yaratish uchun AI (Gemini API kaliti) kerak");
      rateLimit(user.id, 'ai', 40);
      content = { ...(await generateReading({ level, topic, source: text })), generated: true };
    } else if (aiEnabled()) {
      rateLimit(user.id, 'ai', 40);
      try { content = { ...(await generateReading({ level, topic, grounded: mode === 'internet' })), generated: true }; }
      catch (e) { if (mode === 'internet') { try { content = { ...(await generateReading({ level, topic })), generated: true }; notice = "Internet qidiruvi ishlamadi — AI matn yaratdi."; } catch { /* pool */ } } }
    }
    if (!content) {
      content = { ...pickReading(level, Date.now() + user.id), generated: false };
      notice = aiEnabled() ? "AI vaqtincha ishlamadi — tayyor matn berildi." : "AI ulanmagan — tayyor matnlar to'plamidan berildi. API kalitini qo'shsangiz, har safar yangi matn yaratiladi.";
    }
    const id = (await q.run('INSERT INTO trainer_runs(user_id,kind,level,topic,content_json) VALUES(?,?,?,?,?)', user.id, 'reading', level, topic, j(content))).lastInsertRowid;
    return { ...publicRun({ id, kind: 'reading', level, topic, created_at: '' }, content), notice };
  }, { role: 'student' });

  r.post('/api/trainers/listening/new', async ({ user, body }) => {
    const level = await levelOf(body, user.id), topic = topicOf(body);
    const mode = ['generate', 'transcript'].includes(body.mode) ? body.mode : 'generate';
    const format = ['dialogue', 'monologue', 'lecture'].includes(body.format) ? body.format : 'dialogue';
    let content = null, notice = null;
    if (mode === 'transcript') {
      const text = String(body.text || '').trim().slice(0, MAX_TEXT);
      if (text.split(/\s+/).length < 60) throw bad("Transkript juda qisqa (kamida ~60 so'z)");
      if (!aiEnabled()) throw bad("Transkript bo'yicha savol yaratish uchun AI kerak");
      rateLimit(user.id, 'ai', 40);
      content = { ...(await generateListening({ level, topic, format, source: text })), generated: true };
    } else if (aiEnabled()) {
      rateLimit(user.id, 'ai', 40);
      try { content = { ...(await generateListening({ level, topic, format })), generated: true }; } catch { /* pool */ }
    }
    if (!content) {
      content = { ...pickListening(level, Date.now() + user.id), generated: false };
      notice = aiEnabled() ? "AI vaqtincha ishlamadi — tayyor audio berildi." : "AI ulanmagan — tayyor to'plamdan berildi (ovoz brauzer orqali o'qiladi).";
    }
    const id = (await q.run('INSERT INTO trainer_runs(user_id,kind,level,topic,content_json) VALUES(?,?,?,?,?)', user.id, 'listening', level, topic, j(content))).lastInsertRowid;
    return { ...publicRun({ id, kind: 'listening', level, topic, created_at: '' }, content), notice };
  }, { role: 'student' });

  r.get('/api/trainers/runs/:id', async ({ user, params }) => {
    const row = await q.get('SELECT * FROM trainer_runs WHERE id=? AND user_id=?', Number(params.id), user.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    return { ...publicRun(row, unj(row.content_json)), result: unj(row.result_json) };
  }, { role: 'student' });

  r.post('/api/trainers/runs/:id/submit', async ({ user, params, body, date }) => {
    const row = await q.get('SELECT * FROM trainer_runs WHERE id=? AND user_id=?', Number(params.id), user.id);
    if (!row) throw new HttpError(404, 'Topilmadi');
    if (row.result_json) throw bad('Bu mashq allaqachon topshirilgan');
    const content = unj(row.content_json);
    const g = gradeObjective('choice', content.q.map((x) => x.a), body.answers, content.q.map((x) => x.q));
    g.items.forEach((it, i) => { it.givenText = content.q[i].o[it.given] ?? null; it.expectedText = content.q[i].o[it.expected]; });
    const tone = await effectiveTone(user.id, date);
    rateLimit(user.id, 'ai', 40);
    const fb = await objectiveFeedback({ title: `${row.kind === 'reading' ? 'Reading' : 'Listening'} trenajyor: ${content.title}`, tone, level: row.level, score: g.score, items: g.items, topic: row.topic });
    const result = { score: g.score, correct: g.correct, total: g.total, feedback: fb.text, ai: fb.ai, tone, items: g.items.map((x) => ({ ok: x.ok, given: x.givenText, expected: x.expectedText, q: x.q })), transcript: row.kind === 'listening' ? content.lines.map((l) => (content.speakers?.length > 1 ? `${l[0]}: ${l[1]}` : l[1])).join('\n') : undefined };
    await q.run('UPDATE trainer_runs SET result_json=? WHERE id=?', j(result), row.id);
    await q.run('INSERT INTO attempts(user_id,task_id,stage_key,stage_type,skill,topic,score,detail_json,feedback,tone,ai) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      user.id, null, `trainer:${row.kind}:${row.id}`, 'choice', row.kind, row.topic, g.score, j({ items: result.items }), fb.text, tone, fb.ai ? 1 : 0);
    await applyEvidence(user.id, row.kind, evidenceFromScore(LEVEL_DIFF[row.level] ?? 45, g.score), 0.06, date);
    return result;
  }, { role: 'student' });

  r.get('/api/trainers/history', async ({ user, query }) => {
    const kind = ['reading', 'listening'].includes(query.kind) ? query.kind : null;
    const rows = await q.all(`SELECT id, kind, level, topic, content_json, result_json, created_at FROM trainer_runs WHERE user_id=? ${kind ? 'AND kind=?' : ''} ORDER BY id DESC LIMIT 30`, ...(kind ? [user.id, kind] : [user.id]));
    return rows.map((x) => ({ id: x.id, kind: x.kind, level: x.level, topic: x.topic, title: unj(x.content_json)?.title, score: unj(x.result_json)?.score ?? null, created: x.created_at }));
  }, { role: 'student' });
}
