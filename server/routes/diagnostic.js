import { q, j, unj } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import * as D from '../content/diagnostic.js';
import { estimateAbility, LEVEL_DIFF, describe, toCefr, clamp } from '../lib/scale.js';
import { gradeWriting, gradeSpeaking } from '../lib/ai.js';
import { registerTts } from '../lib/gemini.js';
import { setAbility, SKILLS, SKILL_UZ, overall } from '../lib/progress.js';
import { scriptAudio } from '../lessons.js';
import { rateLimit } from '../lib/auth.js';
import { wordCount } from '../lib/grading.js';
import { unitById } from '../lib/content.js';

const SECTIONS = [
  { id: 'grammar', title: "Grammatika (Use of English)", minutes: 14 },
  { id: 'vocab', title: "Lug'at", minutes: 5 },
  { id: 'reading', title: 'Reading', minutes: 14 },
  { id: 'listening', title: 'Listening', minutes: 11 },
  { id: 'writing', title: 'Writing', minutes: 20 },
  { id: 'speaking', title: 'Speaking', minutes: 7 },
];

function publicContent() {
  return {
    grammar: { items: D.grammar.map((x) => ({ q: x.q, o: x.o })) },
    vocab: { items: D.vocab.map((x) => ({ q: x.q, o: x.o })) },
    reading: { passages: D.reading.map((p) => ({ id: p.id, title: p.title, text: p.text, items: p.q.map((x) => ({ q: x.q, o: x.o })) })) },
    listening: { clips: D.listening.map((c) => ({ id: c.id, title: c.title, audio: scriptAudio(c.lines, c.speakers), items: c.q.map((x) => ({ q: x.q, o: x.o })) })) },
    writing: { tasks: D.writing.map((w) => ({ id: w.id, prompt: w.prompt, words: w.words, minutes: w.minutes })) },
    speaking: { tasks: D.speaking.map((s) => ({ id: s.id, prompt: s.prompt, seconds: s.seconds })) },
  };
}

function scoreChoice(items, answers) {
  const graded = items.map((it, i) => ({ d: it.d, ok: Number(answers?.[i]) === it.a }));
  const ability = estimateAbility(graded.map((g) => ({ d: LEVEL_DIFF[g.d], ok: g.ok })));
  const correct = graded.filter((g) => g.ok).length;
  const byLevel = {};
  graded.forEach((g) => { (byLevel[g.d] ||= { c: 0, n: 0 }); byLevel[g.d].n++; if (g.ok) byLevel[g.d].c++; });
  return { ability, correct, total: graded.length, byLevel, graded };
}

async function getDiag(userId) {
  let d = await q.get("SELECT * FROM diagnostics WHERE user_id=? ORDER BY id DESC LIMIT 1", userId);
  if (!d) { const id = (await q.run('INSERT INTO diagnostics(user_id) VALUES(?)', userId)).lastInsertRowid; d = await q.get('SELECT * FROM diagnostics WHERE id=?', id); }
  return d;
}

export function registerDiagnostic(r) {
  r.get('/api/diagnostic', async ({ user }) => {
    const d = await q.get("SELECT * FROM diagnostics WHERE user_id=? ORDER BY id DESC LIMIT 1", user.id);
    const sections = unj(d?.sections_json, {});
    return {
      status: d?.status || 'none', sections: SECTIONS.map((s) => ({ ...s, done: !!sections[s.id] })),
      result: d?.status === 'done' ? unj(d.result_json) : null,
      content: d?.status === 'done' ? null : publicContent(),
      note: "Diagnostika taxminan 60–70 daqiqa davom etadi. Bo'limlarni alohida bajarishingiz va ular orasida tanaffus qilishingiz mumkin.",
    };
  }, { role: 'student' });

  r.post('/api/diagnostic/restart', async ({ user }) => {
    await q.run('INSERT INTO diagnostics(user_id) VALUES(?)', user.id);
    return { ok: true };
  }, { role: 'student' });

  r.post('/api/diagnostic/section/:name', async ({ user, params, body, date }) => {
    const d = await getDiag(user.id);
    if (d.status === 'done') throw bad('Diagnostika yakunlangan. Qayta boshlash uchun «Qayta topshirish» ni bosing.');
    const name = params.name;
    if (!SECTIONS.some((s) => s.id === name)) throw bad("Bunday bo'lim yo'q");
    const sections = unj(d.sections_json, {});
    let res;
    if (name === 'grammar' || name === 'vocab') {
      const items = D[name];
      const s = scoreChoice(items, body.answers);
      const topics = {};
      if (name === 'grammar') s.graded.forEach((g, i) => { const t = items[i].topic; (topics[t] ||= { correct: 0, total: 0 }); topics[t].total++; if (g.ok) topics[t].correct++; });
      res = { ability: s.ability, correct: s.correct, total: s.total, byLevel: s.byLevel, topics, ai: false };
    } else if (name === 'reading' || name === 'listening') {
      const src = D[name];
      const items = [], answers = [];
      src.forEach((p, pi) => p.q.forEach((x, qi) => { items.push(x); answers.push(body.answers?.[pi]?.[qi]); }));
      const s = scoreChoice(items, answers);
      res = { ability: s.ability, correct: s.correct, total: s.total, byLevel: s.byLevel, ai: false };
    } else if (name === 'writing') {
      const texts = D.writing.map((w, i) => String(body.texts?.[i] || '').slice(0, 6000));
      const outs = [];
      for (let i = 0; i < D.writing.length; i++) {
        if (wordCount(texts[i]) < 5) { outs.push(null); continue; }
        rateLimit(user.id, 'ai', 40);
        outs.push(await gradeWriting({ prompt: D.writing[i].prompt, text: texts[i], words: D.writing[i].words, level: D.writing[i].level, tone: 'neutral' }));
      }
      const ok = outs.filter(Boolean);
      // Task 2 counts a little more (as in IELTS)
      const wsum = ok.reduce((s, o, k) => s + (o.ability ?? 0) * (outs.indexOf(o) === 1 ? 2 : 1), 0);
      const wden = ok.reduce((s, o) => s + (outs.indexOf(o) === 1 ? 2 : 1), 0);
      res = { ability: ok.length ? wsum / wden : 10, ai: ok.some((o) => o.ai), tasks: outs.map((o, i) => o && { cefr: o.cefr, band: o.band, criteria: o.criteria, strengths: o.strengths, weaknesses: o.weaknesses, corrections: o.corrections, feedback: o.feedback, words: wordCount(texts[i]) }) };
    } else if (name === 'speaking') {
      const outs = [];
      for (let i = 0; i < D.speaking.length; i++) {
        const wav = body.recordings?.[i];
        if (!wav) { outs.push(null); continue; }
        if (typeof wav !== 'string' || wav.length > 8 * 1024 * 1024) throw bad('Audio juda katta');
        rateLimit(user.id, 'ai', 40);
        outs.push(await gradeSpeaking({ prompt: D.speaking[i].prompt, wav, level: D.speaking[i].level, tone: 'neutral' }));
      }
      const ok = outs.filter((o) => o && o.ai && o.ability != null);
      res = { ability: ok.length ? ok.reduce((s, o) => s + o.ability, 0) / ok.length : null, ai: ok.length > 0, skipped: !outs.some(Boolean),
        tasks: outs.map((o) => o && { transcript: o.transcript, cefr: o.cefr, band: o.band, criteria: o.criteria, strengths: o.strengths, weaknesses: o.weaknesses, corrections: o.corrections, feedback: o.feedback }) };
    }
    sections[name] = res;
    await q.run('UPDATE diagnostics SET sections_json=? WHERE id=?', j(sections), d.id);
    return { ok: true, section: name, summary: { ability: res.ability != null ? describe(res.ability) : null, correct: res.correct, total: res.total, ai: res.ai } };
  }, { role: 'student' });

  r.post('/api/diagnostic/finish', async ({ user, date }) => {
    const d = await getDiag(user.id);
    if (d.status === 'done') return unj(d.result_json);
    const s = unj(d.sections_json, {});
    const missing = SECTIONS.filter((x) => x.id !== 'speaking' && !s[x.id]).map((x) => x.title);
    if (missing.length) throw bad(`Quyidagi bo'limlar topshirilmagan: ${missing.join(', ')}`);
    const abil = { grammar: s.grammar.ability, vocab: s.vocab.ability, reading: s.reading.ability, listening: s.listening.ability, writing: s.writing.ability, speaking: s.speaking?.ability };
    let speakingEstimated = false;
    if (abil.speaking == null) { abil.speaking = clamp((abil.grammar + abil.listening) / 2 - 4, 0, 100); speakingEstimated = true; }
    for (const k of SKILLS) await setAbility(user.id, k, abil[k], date);
    const ov = overall(abil);
    const topics = s.grammar.topics || {};
    const weakTopicIds = Object.entries(topics).filter(([, v]) => v.correct / v.total < 0.65).map(([t]) => t);
    const skills = Object.fromEntries(SKILLS.map((k) => [k, { name: SKILL_UZ[k], ...describe(abil[k]) }]));
    const sorted = [...SKILLS].sort((a, b) => abil[b] - abil[a]);
    const result = {
      overall: describe(ov), skills, speakingEstimated,
      strongest: sorted.slice(0, 2).map((k) => SKILL_UZ[k]), weakest: sorted.slice(-2).map((k) => SKILL_UZ[k]),
      topics, weakTopics: weakTopicIds.map((t) => ({ id: t, title: unitById[t]?.title || t })),
      sections: { writing: s.writing, speaking: s.speaking || null },
      aiAssessedWritingSpeaking: !!(s.writing.ai || s.speaking?.ai), finishedAt: new Date().toISOString(),
    };
    await q.run("UPDATE diagnostics SET status='done', result_json=?, finished_at=datetime('now') WHERE id=?", j(result), d.id);
    return result;
  }, { role: 'student' });
}
