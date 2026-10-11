// Grades one stage submission, stores the attempt, updates skill estimates and task status.
import { q, j, unj } from './db.js';
import { bad } from './http.js';
import { gradeObjective, acceptable, wordCount } from './grading.js';
import { objectiveFeedback, recheck, gradeSentences, gradeWriting, gradeSpeaking } from './ai.js';
import { aiEnabled } from './gemini.js';
import { evidenceFromScore, LEVEL_DIFF, describe } from './scale.js';
import { applyEvidence, effectiveTone } from './progress.js';
import { buildLesson } from '../lessons.js';
import { rateLimit } from './auth.js';

const REVIEW_MODES = new Set(['gap', 'error', 'transform', 'reorder']);

export async function submitStage({ user, taskRow, stageKey, body, date }) {
  const lesson = await buildLesson(taskRow);
  const stage = lesson.stages.find((s) => s.key === stageKey);
  if (!stage) throw bad('Bunday bosqich yo\'q');
  const tone = effectiveTone(user.id, date);
  const level = stage.level;
  const prev = q.get('SELECT COUNT(*) n FROM attempts WHERE task_id=? AND stage_key=?', taskRow.id, stageKey).n;
  let result;

  if (stage.grade === 'none') {
    result = { score: null, feedback: stage.pub.type === 'theory' ? "Nazariya tugadi. Endi mashqlarga o'ting — o'rganganingizni darhol qo'llang." : "So'zlar ko'rib chiqildi. Endi test va mashqlar bilan mustahkamlang.", ai: false, items: [], extra: {} };
  } else if (stage.grade === 'confirm') {
    const note = String(body.note || '').slice(0, 2000);
    if (note.trim().length < 3) throw bad('Qisqacha hisobot yozing');
    result = { score: null, feedback: "Hisobot o'qituvchiga yuborildi.", ai: false, items: [], extra: { note } };
  } else if (['choice', 'match', 'text'].includes(stage.grade)) {
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const g = gradeObjective(stage.grade, stage.keyData, answers, stage.ctx.map((c) => c.q));
    // Present expected/given as readable text
    g.items.forEach((it, i) => {
      const c = stage.ctx[i];
      if (stage.grade === 'choice') { it.givenText = c.o[it.given] ?? null; it.expectedText = c.o[it.expected]; }
      else if (stage.grade === 'match') { it.givenText = c.right[it.given] ?? null; it.expectedText = c.right[it.expected]; }
      else { it.givenText = it.given; it.expectedText = it.expected; }
    });
    if (stage.grade === 'text' && aiEnabled() && REVIEW_MODES.has(stage.pub.mode)) {
      const wrong = g.items.filter((x) => !x.ok && String(x.given || '').trim().length > 2);
      if (wrong.length) {
        rateLimit(user.id, 'ai', 40);
        const ok = await recheck(wrong.map((x) => ({ q: stage.pub.items[x.i].q || stage.pub.items[x.i].words?.join(' / '), expected: x.expectedText, given: x.given })));
        wrong.forEach((x, k) => { if (ok[k]) { x.ok = true; x.aiAccepted = true; } });
        g.correct = g.items.filter((x) => x.ok).length; g.score = g.correct / g.items.length;
      }
    }
    rateLimit(user.id, 'ai', 40);
    const fb = await objectiveFeedback({ title: stage.title, tone, level, score: g.score, items: g.items, topic: stage.topic });
    result = { score: g.score, feedback: fb.text, ai: fb.ai, items: g.items.map((x) => ({ ok: x.ok, given: x.givenText, expected: x.expectedText, q: x.q, aiAccepted: x.aiAccepted })), extra: { correct: g.correct, total: g.total, transcript: stage.transcript } };
  } else if (stage.grade === 'sentences') {
    const answers = (Array.isArray(body.answers) ? body.answers : []).map((a) => String(a || '').slice(0, 500));
    if (answers.every((a) => !a.trim())) throw bad('Hech narsa yozilmagan');
    rateLimit(user.id, 'ai', 40);
    const items = stage.keyData.map((k, i) => ({ ...k, answer: answers[i] || '' }));
    const g = await gradeSentences({ kind: stage.sentenceMode, items, tone, level, focus: stage.focus });
    result = { score: g.score, feedback: g.feedback, ai: g.ai, items: g.items.map((x, i) => ({ ok: x.ok, given: answers[i], expected: x.correction, comment: x.comment, q: stage.ctx[i].q })), extra: {} };
  } else if (stage.grade === 'write') {
    const text = String(body.text || '').slice(0, 8000);
    if (wordCount(text) < 3) throw bad('Matn juda qisqa');
    rateLimit(user.id, 'ai', 40);
    const w = await gradeWriting({ prompt: stage.keyData.prompt, text, words: stage.keyData.words, level, tone, focus: stage.keyData.focus, mini: !!stage.keyData.mini });
    result = { score: w.score, feedback: w.feedback, ai: w.ai, items: [], ability: w.ability, extra: { cefr: w.cefr, band: w.band, criteria: w.criteria, strengths: w.strengths, weaknesses: w.weaknesses, corrections: w.corrections, usedFocus: w.usedFocus, words: wordCount(text), text } };
  } else if (stage.grade === 'speak') {
    const recs = Array.isArray(body.recordings) ? body.recordings : [];
    if (!recs.some(Boolean)) throw bad('Ovoz yozilmagan');
    const outs = [];
    for (let i = 0; i < stage.keyData.length; i++) {
      const wav = recs[i];
      if (wav && (typeof wav !== 'string' || wav.length > 8 * 1024 * 1024)) throw bad('Audio juda katta');
      if (!wav) { outs.push(null); continue; }
      rateLimit(user.id, 'ai', 40);
      outs.push(await gradeSpeaking({ prompt: stage.keyData[i].prompt, wav, level, tone, focus: stage.focus }));
    }
    const graded = outs.filter((o) => o && o.ai && o.score != null);
    const score = graded.length ? graded.reduce((s, o) => s + o.score, 0) / graded.length : null;
    const ab = graded.length ? graded.reduce((s, o) => s + o.ability, 0) / graded.length : null;
    const real = outs.filter(Boolean);
    result = { score, ability: ab, ai: graded.length > 0,
      feedback: real.map((o, i) => (real.length > 1 ? `Savol ${i + 1}: ` : '') + o.feedback).join('\n\n'), items: [],
      extra: { answers: outs.map((o, i) => o && ({ prompt: stage.keyData[i].prompt, transcript: o.transcript, cefr: o.cefr, band: o.band, criteria: o.criteria, strengths: o.strengths, weaknesses: o.weaknesses, corrections: o.corrections, tips: o.tips, usedFocus: o.usedFocus })).filter(Boolean) } };
  }

  // ---- persist ----
  q.run('INSERT INTO attempts(user_id,task_id,stage_key,stage_type,skill,topic,score,detail_json,feedback,tone,ai) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    user.id, taskRow.id, stageKey, stage.pub.type, stage.skill || null, stage.topic || null, result.score, j({ items: result.items, extra: result.extra }), result.feedback, tone, result.ai ? 1 : 0);

  // Skill estimate: first attempt of a stage only (so retries do not inflate the numbers).
  if (prev === 0 && stage.skill) {
    if (result.ability != null) applyEvidence(user.id, stage.skill, result.ability, 0.18, date);
    else if (result.score != null) applyEvidence(user.id, stage.skill, evidenceFromScore(LEVEL_DIFF[level] ?? 45, result.score), 0.07, date);
  }
  // Vocabulary bookkeeping
  if (stage.words && stageKey.startsWith('flash')) {
    for (const w of stage.words) q.run('INSERT OR IGNORE INTO learned_words(user_id,word,topic,learned_on) VALUES(?,?,?,?)', user.id, w.w.toLowerCase(), w.topic || null, date);
  }
  if (stage.skill === 'vocab' && result.items?.length && stage.grade !== 'sentences') {
    // not tracked per word for quizzes with generated distractors; keep it simple
  }

  // Task status
  const done = new Set(q.all('SELECT DISTINCT stage_key FROM attempts WHERE task_id=?', taskRow.id).map((r) => r.stage_key));
  const allDone = lesson.stages.every((s) => done.has(s.key));
  const scores = lesson.stages.map((s) => q.get('SELECT score FROM attempts WHERE task_id=? AND stage_key=? AND score IS NOT NULL ORDER BY id DESC LIMIT 1', taskRow.id, s.key)?.score).filter((x) => x != null);
  const taskScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  q.run("UPDATE tasks SET status=?, score=?, done_at=CASE WHEN ?=1 THEN datetime('now') ELSE done_at END WHERE id=?", allDone ? 'done' : 'partial', taskScore, allDone ? 1 : 0, taskRow.id);

  return { ...result, tone, stageKey, task: { status: allDone ? 'done' : 'partial', score: taskScore, doneStages: [...done] }, level: stage.level ? describe(LEVEL_DIFF[stage.level]).cefr : null };
}
