// Authoring checks: every lesson and pool item must be well-formed and self-consistent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { units } from '../server/lib/content.js';
import { readingPool, listeningPool, writingPool, speakingPool, letterTasks, mockSpeaking } from '../server/content/pools.js';
import { topics, general } from '../server/content/vocab.js';
import { personas } from '../server/content/personas.js';
import { grammarStageKeys } from '../server/lessons.js';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

test('grammar units: complete, unique ids, valid answer keys', () => {
  assert.ok(units.length >= 26);
  assert.equal(new Set(units.map((u) => u.id)).size, units.length, 'unique ids');
  for (const u of units) {
    const at = (m) => `${u.id}: ${m}`;
    assert.ok(LEVELS.includes(u.level), at('level'));
    assert.ok(u.theory.length >= 2 && u.theory.every((t) => t.t && t.h.length > 40), at('theory'));
    for (const m of u.mcq) { assert.equal(m.o.length, 4, at('mcq options')); assert.ok(m.a >= 0 && m.a < m.o.length, at('mcq key')); assert.equal(new Set(m.o).size, 4, at('mcq distinct options: ' + m.q)); assert.ok(m.q.includes('___') || m.q.includes('?') || m.q.length > 10); }
    assert.ok(u.mcq.length >= 4 && u.gap.length >= 4 && u.error.length >= 3 && u.transform.length >= 3 && u.tf.length >= 3, at('item counts'));
    for (const g of u.gap) assert.ok(g.a.length && [].concat(g.a).every((x) => x.trim()), at('gap answer: ' + g.q));
    for (const e of u.error) assert.ok([].concat(e.a).every((x) => x.trim() && x !== e.q), at('error answer must differ from the wrong sentence: ' + e.q));
    for (const r of u.reorder) assert.ok(r.split(/\s+/).length >= 4, at('reorder length'));
    for (const t of u.transform) assert.ok([].concat(t.a).length >= 1 && t.q.includes('('), at('transform instruction: ' + t.q));
    assert.equal(u.match.length, 5, at('match pairs')); assert.ok(new Set(u.match.map((p) => p[1])).size >= 3, at('match needs at least 3 distinct answers'));
    assert.equal(u.dictation.length, 2); assert.equal(u.make.length, 4); assert.ok(u.translate.length >= 2);
    assert.ok(u.write.prompt && u.write.min >= 30 && u.speak.prompt && u.focus, at('write/speak/focus'));
    assert.ok(u.passage.text.split(/\s+/).length >= 40, at('passage'));
    for (const q of u.passage.q) { assert.ok(q.o.length >= 3 && q.a < q.o.length, at('passage key')); }
  }
});

test('lesson stage selection always starts with theory/quiz basics and grows with the time budget', () => {
  assert.deepEqual(grammarStageKeys(30, 'new').slice(0, 3), ['theory', 'mcq', 'gap']);
  assert.ok(grammarStageKeys(30, 'new').length < grammarStageKeys(120, 'new').length);
  assert.equal(grammarStageKeys(500, 'new').length, 15, 'full lesson has 15 activity types');
});

test('reading / listening / writing / speaking pools are valid and cover every level', () => {
  for (const [name, pool] of [['reading', readingPool], ['listening', listeningPool]]) {
    assert.equal(new Set(pool.map((x) => x.id)).size, pool.length, name + ' ids unique');
    for (const x of pool) { assert.ok(LEVELS.includes(x.level)); assert.ok(x.q.length >= 3); for (const q of x.q) assert.ok(q.a >= 0 && q.a < q.o.length && q.o.length >= 2, `${x.id}: key`); }
    for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1']) assert.ok(pool.some((x) => x.level === lv), `${name} has ${lv}`);
  }
  for (const x of listeningPool) { assert.ok(x.lines.length >= 1 && x.lines.every((l) => l[0] && l[1])); const sp = new Set(x.lines.map((l) => l[0])); assert.ok(sp.size <= 2, x.id + ': at most 2 speakers (TTS limit)'); }
  for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1']) { assert.ok(writingPool.some((x) => x.level === lv), 'writing ' + lv); assert.ok(speakingPool.some((x) => x.level === lv), 'speaking ' + lv); }
  assert.ok(letterTasks.length >= 6 && mockSpeaking.part2.length >= 5 && Object.keys(mockSpeaking.part3).length >= 4);
  for (const c of mockSpeaking.part2) assert.ok(mockSpeaking.part3[c.theme] || c.theme, 'cue card theme');
});

test('vocabulary banks: 40 words per topic, no duplicates, complete entries', () => {
  for (const t of topics) {
    assert.equal(t.words.length, 40, t.id);
    assert.equal(new Set(t.words.map((w) => w.w.toLowerCase())).size, 40, t.id + ' duplicates');
    for (const w of t.words) assert.ok(w.w && w.uz && w.ex && w.pos, `${t.id}:${w.w}`);
  }
  for (const [lv, list] of Object.entries(general)) { assert.ok(list.length >= 20, lv); assert.equal(new Set(list.map((w) => w.w.toLowerCase())).size, list.length, lv); }
});

test('ten speaking personas with distinct voices and respectful style rules', () => {
  assert.equal(personas.length, 10);
  assert.equal(new Set(personas.map((p) => p.id)).size, 10);
  assert.ok(new Set(personas.map((p) => p.voice)).size >= 9, 'voices are mostly distinct');
  const strict = personas.find((p) => p.id === 'victor');
  assert.match(strict.style, /NEVER insult/i);
});

test('matching exercise: pairs that share an answer are all gradable (regression)', async () => {
  const { buildLesson } = await import('../server/lessons.js');
  const u = units.find((x) => x.id === 'present-continuous');           // three pairs answer "Continuous"
  const row = { id: 99, user_id: 1, type: 'grammar', minutes: 120, ref_json: JSON.stringify({ unit: u.id, mode: 'new' }), source: 'plan' };
  const lesson = await buildLesson(row);
  const st = lesson.stages.find((s) => s.key === 'match');
  assert.equal(new Set(st.pub.right).size, st.pub.right.length, 'options are unique');
  const { gradeObjective } = await import('../server/lib/grading.js');
  const answers = u.match.map(([, r]) => st.pub.right.indexOf(r));
  assert.equal(gradeObjective('match', st.keyData, answers).score, 1, 'every correct selection scores');
});
