// Turns a stored task row into a playable lesson: public stages for the browser + private answer keys for grading.
import { q, unj } from './lib/db.js';
import { aiEnabled, registerTts } from './lib/gemini.js';
import { shuffle } from './lib/rng.js';
import { LEVEL_DIFF } from './lib/scale.js';
import {
  unitById, topicById, loadVocabCache, buildWordIndex, topicPoolFrom, generalPoolFrom, growTopic, growGeneral, topicCatalog,
  readingFor, listeningFor, promptFor, cacheGet, cacheSet,
} from './lib/content.js';
import { levelIndex } from './lib/scale.js';
import { dueWords } from './lib/srs.js';

export const SKILL_OF = { grammar: 'grammar', vocab: 'vocab', reading: 'reading', listening: 'listening', speaking: 'speaking', writing: 'writing', custom: null };
export const TYPE_UZ = { srs: "So'z takrorlash", grammar: 'Grammatika', vocab: "Lug'at", reading: 'Reading', listening: 'Listening', speaking: 'Speaking', writing: 'Writing', custom: "Qo'shimcha topshiriq" };
const dOf = (lvl) => LEVEL_DIFF[lvl] ?? 45;

// ---- stage helpers ---------------------------------------------------------
const choiceStage = (key, title, minutes, items, { skill, level, topic, passage, audio, transcript, instructions, glossary }) => ({
  key, title, minutes, skill, level, topic, grade: 'choice', transcript,
  keyData: items.map((i) => i.a),
  ctx: items.map((i) => ({ q: i.q, o: i.o })),
  pub: { type: 'choice', instructions: instructions || "To'g'ri javobni tanlang.", items: items.map((i) => ({ q: i.q, o: i.o })), passage, audio, glossary },
});
const textStage = (key, title, minutes, mode, items, { skill, level, topic, instructions }) => ({
  key, title, minutes, skill, level, topic, grade: 'text',
  keyData: items.map((i) => (Array.isArray(i.a) ? i.a : [i.a])),
  ctx: items.map((i) => ({ q: i.q || '(audio)' })),
  pub: { type: 'text', mode, instructions, items: items.map((i) => ({ q: i.q, words: i.words, audio: i.audio, hint: i.hint })) },
});

const unitPassageAudio = (text) => registerTts(text, { voice: 'Kore', style: 'Read this passage clearly at a natural, moderate pace' });
const sentenceAudio = (text) => registerTts(text, { voice: 'Kore', style: 'Say this sentence clearly at a moderate pace' });

export function scriptAudio(lines, speakers) {
  const names = speakers?.length ? speakers : [...new Set(lines.map((l) => l[0]))];
  if (names.length === 2) {
    const text = `TTS the following conversation between ${names[0]} and ${names[1]}:\n` + lines.map((l) => `${l[0]}: ${l[1]}`).join('\n');
    return registerTts(text, { speakers: [{ name: names[0], voice: 'Kore' }, { name: names[1], voice: 'Puck' }] });
  }
  return registerTts(lines.map((l) => l[1]).join('\n\n'), { voice: 'Kore', style: 'Read this clearly and naturally as a spoken talk' });
}

// ---- grammar --------------------------------------------------------------------
const GR_ORDER = ['theory', 'mcq', 'gap', 'error', 'reorder', 'transform', 'match', 'tf', 'read', 'listen', 'dictation', 'make', 'translate', 'speak', 'write'];
const GR_MIN = { theory: 12, mcq: 5, gap: 6, error: 5, reorder: 4, transform: 6, match: 3, tf: 3, read: 8, listen: 8, dictation: 6, make: 8, translate: 8, speak: 8, write: 12 };
const GR_PRIORITY = ['theory', 'mcq', 'gap', 'make', 'read', 'error', 'reorder', 'transform', 'translate', 'speak', 'dictation', 'listen', 'write', 'tf', 'match'];
export const GRAMMAR_FULL_MINUTES = Object.values(GR_MIN).reduce((a, b) => a + b, 0);

export function grammarStageKeys(budget, mode) {
  const chosen = new Set(); let sum = 0;
  for (const k of GR_PRIORITY) {
    if (sum >= budget && chosen.size >= 3) break;
    chosen.add(k); sum += k === 'theory' && mode === 'review' ? 5 : GR_MIN[k];
  }
  return GR_ORDER.filter((k) => chosen.has(k));
}

function grammarStages(task, unit, mode) {
  const seed = `${task.id}:${unit.id}`;
  const base = { skill: 'grammar', level: unit.level, topic: unit.id };
  const review = mode === 'review';
  const pick = (arr) => (review ? shuffle(arr, seed).slice(0, Math.max(2, Math.ceil(arr.length * 0.75))) : arr);
  const out = [];
  for (const k of grammarStageKeys(task.minutes, mode)) {
    const min = k === 'theory' && review ? 5 : GR_MIN[k];
    if (k === 'theory') {
      out.push({ key: 'theory', title: review ? `Qisqa takrorlash: ${unit.title}` : `Nazariya: ${unit.title}`, minutes: min, ...base, grade: 'none',
        pub: { type: 'theory', instructions: "Slaydlarni diqqat bilan o'qing. Misollarni ovoz chiqarib takrorlang.", sections: unit.theory } });
    } else if (k === 'mcq') {
      out.push(choiceStage('mcq', 'Test: to\'g\'ri javobni tanlang', min, pick(unit.mcq), base));
    } else if (k === 'tf') {
      const items = pick(unit.tf).map((x) => ({ q: x.q, o: ['True', 'False'], a: x.a ? 0 : 1 }));
      out.push(choiceStage('tf', "True / False", min, items, { ...base, instructions: "Gap to'g'ri bo'lsa True, noto'g'ri bo'lsa False tanlang." }));
    } else if (k === 'gap') {
      out.push(textStage('gap', "Bo'sh joyni to'ldiring", min, 'gap', pick(unit.gap), { ...base, instructions: "Qavs ichidagi so'zni kerakli shaklda yozing (bir nechta so'z bo'lishi mumkin)." }));
    } else if (k === 'error') {
      out.push(textStage('error', 'Xatoni toping va tuzating', min, 'error', pick(unit.error), { ...base, instructions: "Har bir gapda xato bor. Butun gapni to'g'ri yozing." }));
    } else if (k === 'reorder') {
      const items = pick(unit.reorder).map((s, i) => {
        const toks = s.split(/\s+/).map((t, ti) => (ti === 0 && t !== 'I' && !/^I'/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t));
        let words = shuffle(toks.map((t) => t.replace(/[.?!]$/, '')), `${seed}:re${i}`);
        if (words.join(' ') === toks.map((t) => t.replace(/[.?!]$/, '')).join(' ')) words = words.reverse();
        return { words, a: [s], q: null };
      });
      out.push(textStage('reorder', "So'zlardan gap tuzing", min, 'reorder', items, { ...base, instructions: "So'zlarni to'g'ri tartibda bosing." }));
    } else if (k === 'transform') {
      out.push(textStage('transform', 'Gapni qayta yozing', min, 'transform', pick(unit.transform), { ...base, instructions: "Qavs ichidagi ko'rsatmaga amal qilib, butun gapni yozing." }));
    } else if (k === 'match') {
      const pairs = unit.match;
      const right = shuffle([...new Set(pairs.map((p) => p[1]))], `${seed}:m`);   // unique options: several pairs may share an answer
      out.push({ key: 'match', title: 'Juftliklarni moslashtiring', minutes: min, ...base, grade: 'match',
        keyData: pairs.map((p) => right.indexOf(p[1])), ctx: pairs.map((p) => ({ q: p[0], right })),
        pub: { type: 'match', instructions: "Chap ustundagi har bir elementga mos javobni tanlang.", left: pairs.map((p) => p[0]), right } });
    } else if (k === 'read' || k === 'listen') {
      const p = unit.passage;
      const items = pick(p.q);
      const isL = k === 'listen';
      out.push(choiceStage(isL ? 'listen' : 'read', isL ? `Listening: ${p.title}` : `Reading: ${p.title}`, min, items, {
        ...base, skill: isL ? 'listening' : 'reading',
        passage: isL ? undefined : { title: p.title, text: p.text },
        audio: isL ? unitPassageAudio(p.text) : undefined, transcript: isL ? p.text : undefined,
        instructions: isL ? "Audioni tinglang (istagancha takrorlashingiz mumkin) va savollarga javob bering." : "Matnni o'qing va savollarga javob bering.",
      }));
    } else if (k === 'dictation') {
      const items = pick(unit.dictation).map((s) => ({ audio: sentenceAudio(s), a: [s] }));
      out.push(textStage('dictation', 'Diktant: eshitib yozing', min, 'dictation', items, { ...base, skill: 'listening', instructions: "Audioni tinglang va eshitgan gapingizni aynan yozing." }));
    } else if (k === 'make') {
      out.push({ key: 'make', title: "Berilgan so'zlar bilan gap tuzing", minutes: min, ...base, skill: 'writing', grade: 'sentences', sentenceMode: 'make',
        keyData: unit.make.map((w) => ({ word: w })), ctx: unit.make.map((w) => ({ q: w })),
        pub: { type: 'sentences', mode: 'make', instructions: "Har bir so'z yoki ibora bilan bittadan to'g'ri va tabiiy gap tuzing.", items: unit.make.map((w) => ({ prompt: w })) } });
    } else if (k === 'translate') {
      const items = pick(unit.translate);
      out.push({ key: 'translate', title: 'Tarjima: uzbekchadan inglizchaga', minutes: min, ...base, skill: 'writing', grade: 'sentences', sentenceMode: 'translate',
        keyData: items.map((x) => ({ reference: x.a, prompt: x.q })), ctx: items.map((x) => ({ q: x.q })),
        pub: { type: 'sentences', mode: 'translate', instructions: "Gaplarni ingliz tiliga tarjima qiling.", items: items.map((x) => ({ prompt: x.q })) } });
    } else if (k === 'speak') {
      out.push({ key: 'speak', title: 'Speaking: mavzuni gapirib mashq qiling', minutes: min, ...base, skill: 'speaking', grade: 'speak', focus: unit.focus,
        keyData: [{ prompt: unit.speak.prompt }], ctx: [{ q: unit.speak.prompt }],
        pub: { type: 'speak', instructions: "Yozib olish tugmasini bosing, javob bering. Kamida 30 soniya gapirishga harakat qiling.", items: [{ prompt: unit.speak.prompt, seconds: 60 }], focus: unit.focus } });
    } else if (k === 'write') {
      out.push({ key: 'write', title: 'Yozma ish', minutes: min, ...base, skill: 'writing', grade: 'write', focus: unit.focus,
        keyData: { prompt: unit.write.prompt, words: [unit.write.min, unit.write.min * 2.5], focus: unit.focus }, ctx: [{ q: unit.write.prompt }],
        pub: { type: 'write', instructions: 'Mavzu bo\'yicha ingliz tilida yozing.', prompt: unit.write.prompt, words: [unit.write.min, Math.round(unit.write.min * 2.5)], focus: unit.focus } });
    }
  }
  return out;
}

// ---- vocabulary ----------------------------------------------------------------------
export async function vocabSelection(task) {
  const key = `task:${task.id}:words`;
  const cached = await cacheGet(key);
  if (cached) return cached;
  const ref = task.ref;
  const nTopic = ref.nTopic ?? 40, nGeneral = ref.nGeneral ?? 12;
  const learned = new Set((await q.all('SELECT word FROM learned_words WHERE user_id=?', task.user_id)).map((r) => r.word));
  const fresh = (pool) => pool.filter((w) => !learned.has(w.w.toLowerCase()));
  const used = new Set();
  const take = (pool, n) => { const out = []; for (const w of pool) { const k = w.w.toLowerCase(); if (out.length >= n) break; if (!learned.has(k) && !used.has(k)) { used.add(k); out.push(w); } } return out; };

  let cache = await loadVocabCache();
  let topicPool = topicPoolFrom(cache, ref.topic);
  if (fresh(topicPool).length < nTopic && aiEnabled()) { try { await growTopic(ref.topic, 40); cache = await loadVocabCache(); topicPool = topicPoolFrom(cache, ref.topic); } catch { /* ignore */ } }
  let topicWords = take(topicPool, nTopic);
  let borrowed = false;
  if (topicWords.length < nTopic) { // top up from the nearest other topics
    const li = levelIndex(ref.level);
    const others = topicCatalog.filter((t) => t.id !== ref.topic).sort((a, b) => Math.abs(levelIndex(a.level) - li) - Math.abs(levelIndex(b.level) - li));
    for (const t of others) { if (topicWords.length >= nTopic) break; topicWords = topicWords.concat(take(topicPoolFrom(cache, t.id), nTopic - topicWords.length)); borrowed = true; }
  }
  let genPool = generalPoolFrom(cache, ref.level);
  if (fresh(genPool).length < nGeneral && aiEnabled()) { try { await growGeneral(ref.level, 40); cache = await loadVocabCache(); genPool = generalPoolFrom(cache, ref.level); } catch { /* ignore */ } }
  let generalWords = take(genPool, nGeneral);
  if (generalWords.length < nGeneral) { // neighbouring levels
    for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1'].sort((a, b) => Math.abs(levelIndex(a) - levelIndex(ref.level)) - Math.abs(levelIndex(b) - levelIndex(ref.level)))) {
      if (generalWords.length >= nGeneral) break;
      generalWords = generalWords.concat(take(generalPoolFrom(cache, lv), nGeneral - generalWords.length));
    }
  }
  // Not enough unseen words (offline content exhausted): fill with the weakest already-learned words as review.
  const target = nTopic + nGeneral;
  let reviewWords = [];
  const newCount = topicWords.length + generalWords.length;
  if (newCount < target) {
    const rows = await q.all('SELECT word, topic FROM learned_words WHERE user_id=? ORDER BY (right_n - wrong_n), learned_on LIMIT ?', task.user_id, target - newCount);
    const all = new Map();
    for (const t of topicCatalog) for (const w of topicPoolFrom(cache, t.id)) all.set(w.w.toLowerCase(), w);
    for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1']) for (const w of generalPoolFrom(cache, lv)) all.set(w.w.toLowerCase(), w);
    reviewWords = rows.map((r) => all.get(r.word)).filter(Boolean);
  }
  const sel = { topic: ref.topic, topicWords, generalWords, reviewWords, newCount, borrowed, target };
  await cacheSet(key, 'vocab-task', sel);
  return sel;
}

function flashStage(key, title, words, base, minutes) {
  return { key, title, minutes, ...base, grade: 'none', words,
    pub: { type: 'flash', instructions: "Har bir so'zni o'qing, ovozini eshiting va misolni takrorlang. Tugagach «Yodladim» ni bosing.",
      words: words.map((w) => ({ w: w.w, pos: w.pos, uz: w.uz, ex: w.ex, audio: sentenceAudio(w.w), exAudio: sentenceAudio(w.ex) })) } };
}

async function vocabStages(task, sel) {
  const base = { skill: 'vocab', level: task.ref.level, topic: task.ref.topic };
  const seed = `v${task.id}`;
  const all = [...sel.topicWords, ...sel.generalWords, ...sel.reviewWords];
  const out = [];
  const tTitle = topicById[sel.topic]?.title || sel.topic;
  if (sel.topicWords.length) out.push(flashStage('flash-topic', `Mavzu so'zlari: ${tTitle} (${sel.topicWords.length} ta)`, sel.topicWords, base, Math.ceil(sel.topicWords.length * 0.45)));
  if (sel.generalWords.length) out.push(flashStage('flash-general', `Kundalik so'zlar (${sel.generalWords.length} ta)`, sel.generalWords, base, Math.ceil(sel.generalWords.length * 0.45)));
  if (sel.reviewWords.length) out.push(flashStage('flash-review', `Takrorlash so'zlari (${sel.reviewWords.length} ta)`, sel.reviewWords, base, Math.ceil(sel.reviewWords.length * 0.3)));
  if (all.length < 4) return out;
  const poolForDistractors = [...new Map([...all, ...topicPoolFrom(await loadVocabCache(), sel.topic)].map((w) => [w.w.toLowerCase(), w])).values()];
  const quizWords = shuffle(all, seed + 'q').slice(0, 25);
  const quizItems = quizWords.map((w, i) => {
    const others = shuffle(poolForDistractors.filter((x) => x.w !== w.w), `${seed}:d${i}`).slice(0, 3);
    if (i % 2 === 0) {
      const opts = shuffle([w, ...others], `${seed}:o${i}`);
      return { q: `"${w.uz}" — inglizchasi qaysi?`, o: opts.map((x) => x.w), a: opts.indexOf(w) };
    }
    const opts = shuffle([w, ...others], `${seed}:o${i}`);
    return { q: `"${w.w}" (${w.pos}) — ma'nosi qaysi?`, o: opts.map((x) => x.uz), a: opts.indexOf(w) };
  });
  const quizStage = choiceStage('vquiz', "Test: so'z ma'nolari", Math.ceil(quizItems.length * 0.25), quizItems, { ...base, instructions: "To'g'ri javobni tanlang." });
  quizStage.srsWords = quizWords.map((w) => w.w.toLowerCase()); quizStage.srsFirst = true;
  out.push(quizStage);
  const recallWords = shuffle(all, seed + 'r').slice(0, 15);
  const recallStage = textStage('vrecall', "Esga tushiring: inglizchasini yozing", Math.ceil(recallWords.length * 0.4), 'recall',
    recallWords.map((w) => ({ q: `${w.uz}  (${w.pos})`, hint: `${w.w[0]}${'_'.repeat(Math.max(0, w.w.length - 1))}`, a: [w.w] })), { ...base, instructions: "O'zbekcha ma'noga mos inglizcha so'zni yozing. Birinchi harf berilgan." });
  recallStage.srsWords = recallWords.map((w) => w.w.toLowerCase()); recallStage.srsFirst = true;
  out.push(recallStage);
  const dict = shuffle(all.filter((w) => !w.w.includes(' ')), seed + 'd').slice(0, 6);
  if (dict.length >= 3) out.push(textStage('vdict', "Diktant: so'zni eshitib yozing", Math.ceil(dict.length * 0.3), 'dictation', dict.map((w) => ({ audio: sentenceAudio(w.w), a: [w.w] })), { ...base, skill: 'listening', instructions: "So'zni tinglang va to'g'ri imlo bilan yozing." }));
  const mk = shuffle(all, seed + 'm').slice(0, 8).map((w) => w.w);
  out.push({ key: 'vmake', title: "So'zlar bilan gap tuzing", minutes: Math.ceil(mk.length * 1.2), ...base, skill: 'writing', grade: 'sentences', sentenceMode: 'make',
    keyData: mk.map((w) => ({ word: w })), ctx: mk.map((w) => ({ q: w })),
    pub: { type: 'sentences', mode: 'make', instructions: "Har bir so'z bilan o'zingizning gapingizni tuzing — shunda so'z esda qoladi.", items: mk.map((w) => ({ prompt: w })) } });
  return out;
}

// ---- reading / listening / speaking / writing -----------------------------------
async function readingStages(task) {
  const r = task.ref;
  const c = await readingFor(`task:${task.id}:content`, { level: r.level, topic: r.topic, grounded: !!r.grounded, source: r.source }, task.id);
  const base = { skill: 'reading', level: c.level || r.level, topic: c.topic || r.topic };
  const read = choiceStage('read', `Reading: ${c.title}`, Math.max(10, Math.round(task.minutes * 0.7)), c.q, {
    ...base, passage: { title: c.title, text: c.text, source: c.source || undefined }, glossary: c.vocabulary,
    instructions: "Matnni diqqat bilan o'qing va savollarga javob bering. Vaqtni o'lchang: matn uchun 1 daqiqada ~150 so'z.",
  });
  const sum = { key: 'summary', title: 'Qisqacha mazmun (summary)', minutes: Math.max(5, Math.round(task.minutes * 0.3)), ...base, skill: 'writing', grade: 'write', focus: null,
    keyData: { prompt: `Summarise the text "${c.title}" in 2–3 sentences in your own words.`, words: [25, 70], mini: true }, ctx: [{ q: 'summary' }],
    pub: { type: 'write', instructions: "Matnni o'z so'zlaringiz bilan 2–3 gapda ingliz tilida qisqacha bayon qiling.", prompt: `Summarise the text "${c.title}" in 2–3 sentences in your own words.`, words: [25, 70] } };
  return [read, sum];
}

async function listeningStages(task) {
  const r = task.ref;
  const c = await listeningFor(`task:${task.id}:content`, { level: r.level, topic: r.topic, format: r.format || 'monologue', source: r.source }, task.id);
  const base = { skill: 'listening', level: c.level || r.level, topic: c.topic || r.topic };
  const transcript = c.lines.map((l) => (c.speakers?.length > 1 ? `${l[0]}: ${l[1]}` : l[1])).join('\n');
  const main = choiceStage('listen', `Listening: ${c.title}`, Math.max(10, Math.round(task.minutes * 0.7)), c.q, {
    ...base, audio: scriptAudio(c.lines, c.speakers), transcript,
    instructions: "Audioni tinglang. Avval savollarni o'qib oling, so'ng tinglang. Imtihonda audio bir marta eshittiriladi — mashq uchun takrorlashingiz mumkin.",
  });
  const sentences = c.lines.flatMap((l) => l[1].split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter((s) => { const n = s.split(/\s+/).length; return n >= 5 && n <= 16; });
  const picks = shuffle(sentences, `ld${task.id}`).slice(0, 3);
  const out = [main];
  if (picks.length >= 2) out.push(textStage('dictation', 'Diktant: eshitib yozing', Math.max(5, Math.round(task.minutes * 0.3)), 'dictation', picks.map((s) => ({ audio: sentenceAudio(s), a: [s] })), { ...base, instructions: "Gaplarni tinglang va aynan yozing." }));
  return out;
}

async function speakingStages(task) {
  const r = task.ref, base = { skill: 'speaking', level: r.level, topic: r.topic };
  const n = Math.max(1, Math.min(4, r.n || Math.round(task.minutes / 8)));
  const items = [];
  for (let i = 0; i < n; i++) {
    const p = await promptFor(`task:${task.id}:sp${i}`, 'speaking', { level: r.level, topic: r.topic, focus: r.focus }, `${task.id}:${i}`);
    items.push({ prompt: p.prompt, seconds: p.seconds || 60 });
  }
  return [{ key: 'speak', title: 'Speaking topshirig\'i', minutes: task.minutes, ...base, grade: 'speak', focus: r.focus || null,
    keyData: items.map((x) => ({ prompt: x.prompt })), ctx: items.map((x) => ({ q: x.prompt })),
    pub: { type: 'speak', instructions: "Har bir savol uchun yozib oling. Tayyorlanish uchun 20–30 soniya oling, so'ng to'xtamay gapiring.", items, focus: r.focus || null } }];
}

async function writingStages(task) {
  const r = task.ref, base = { skill: 'writing', level: r.level, topic: r.topic };
  const p = await promptFor(`task:${task.id}:wr`, 'writing', { level: r.level, topic: r.topic, focus: r.focus }, task.id);
  const words = p.words || [100, 160];
  return [{ key: 'write', title: 'Yozma topshiriq', minutes: task.minutes, ...base, grade: 'write', focus: r.focus || null,
    keyData: { prompt: p.prompt, words, focus: r.focus || null }, ctx: [{ q: p.prompt }],
    pub: { type: 'write', instructions: "Rejalashtiring (3–5 daqiqa), yozing, so'ng tekshiring.", prompt: p.prompt, words, focus: r.focus || null } }];
}

function customStages(task) {
  const r = task.ref, base = { skill: r.skill || null, level: r.level || 'B1', topic: 'teacher' };
  const info = { type: 'info', title: r.title, text: r.instructions };
  if (r.mode === 'speak') {
    return [{ key: 'custom', title: r.title, minutes: task.minutes, ...base, skill: 'speaking', grade: 'speak', focus: null,
      keyData: [{ prompt: r.instructions }], ctx: [{ q: r.instructions }], pub: { type: 'speak', instructions: "O'qituvchi topshirig'i. Javobingizni yozib oling.", items: [{ prompt: r.instructions, seconds: 90 }], info } }];
  }
  if (r.mode === 'write') {
    return [{ key: 'custom', title: r.title, minutes: task.minutes, ...base, skill: 'writing', grade: 'write', focus: null,
      keyData: { prompt: r.instructions, words: [r.minWords || 50, r.maxWords || 300] }, ctx: [{ q: r.instructions }],
      pub: { type: 'write', instructions: "O'qituvchi topshirig'i.", prompt: r.instructions, words: [r.minWords || 50, r.maxWords || 300], info } }];
  }
  return [{ key: 'custom', title: r.title, minutes: task.minutes, ...base, grade: 'confirm', keyData: null, ctx: [],
    pub: { type: 'confirm', instructions: "Topshiriqni bajarib bo'lgach, qisqacha hisobot yozing va tasdiqlang.", info } }];
}

async function srsStages(task) {
  const key = `task:${task.id}:srs`;
  let list = await cacheGet(key);
  if (!list) {
    list = (await dueWords(task.user_id, task.date, 30)).map((r) => r.word);
    await cacheSet(key, 'srs-task', list);
  }
  const index = buildWordIndex(await loadVocabCache());
  const words = list.map((w) => index.get(w)).filter(Boolean);
  const base = { skill: 'vocab', level: 'B1', topic: 'srs' };
  if (words.length < 2) return [];
  const pool = [...index.values()];
  const seed = `srs${task.id}`;
  const quizWords = shuffle(words, seed + 'q').slice(0, 20);
  const quizItems = quizWords.map((w, i) => {
    const others = shuffle(pool.filter((x) => x.w !== w.w), `${seed}:d${i}`).slice(0, 3);
    const opts = shuffle([w, ...others], `${seed}:o${i}`);
    return i % 2 === 0 ? { q: `"${w.uz}" — inglizchasi qaysi?`, o: opts.map((x) => x.w), a: opts.indexOf(w) } : { q: `"${w.w}" (${w.pos}) — ma'nosi qaysi?`, o: opts.map((x) => x.uz), a: opts.indexOf(w) };
  });
  const quiz = choiceStage('srs-quiz', "Takrorlash testi", Math.max(3, Math.ceil(quizItems.length * 0.25)), quizItems, { ...base, instructions: "Avval o'rgangan so'zlaringizni eslang. To'g'ri javob so'zni keyingi takrorlashga uzoqroq muddatga suradi." });
  quiz.srsWords = quizWords.map((w) => w.w.toLowerCase());
  const recallWords = shuffle(words, seed + 'r').slice(0, 12);
  const recall = textStage('srs-recall', 'Esga tushiring: inglizchasini yozing', Math.max(3, Math.ceil(recallWords.length * 0.4)), 'recall',
    recallWords.map((w) => ({ q: `${w.uz}  (${w.pos})`, hint: `${w.w[0]}${'_'.repeat(Math.max(0, w.w.length - 1))}`, a: [w.w] })), { ...base, instructions: "O'zbekcha ma'noga mos inglizcha so'zni yozing. Birinchi harf berilgan." });
  recall.srsWords = recallWords.map((w) => w.w.toLowerCase());
  return [quiz, recall];
}

// ---- public API ---------------------------------------------------------------------
export function hydrate(row) {
  return { ...row, ref: unj(row.ref_json, {}) };
}

export function describeTask(task) {
  const r = task.ref || {};
  switch (task.type) {
    case 'grammar': { const u = unitById[r.unit]; return { title: u ? u.title : 'Grammatika', subtitle: r.mode === 'review' ? 'Takrorlash' : 'Yangi mavzu', level: u?.level }; }
    case 'srs': return { title: "So'z takrorlash", subtitle: `${r.count ?? ''} ta so'z — intervalli takrorlash`.trim(), level: 'B1' };
    case 'vocab': return { title: `${topicById[r.topic]?.title || r.topic} — so'zlar`, subtitle: `${(r.nTopic ?? 40) + (r.nGeneral ?? 12)} ta so'z (${r.nTopic ?? 40} mavzu + ${r.nGeneral ?? 12} kundalik)`, level: r.level };
    case 'reading': return { title: 'Reading', subtitle: `${r.level}${r.topic ? ' · ' + r.topic : ''}`, level: r.level };
    case 'listening': return { title: 'Listening', subtitle: `${r.level}${r.topic ? ' · ' + r.topic : ''}`, level: r.level };
    case 'speaking': return { title: 'Speaking', subtitle: r.focus ? `Fokus: ${r.focus}` : `${r.level}`, level: r.level };
    case 'writing': return { title: 'Writing', subtitle: r.focus ? `Fokus: ${r.focus}` : `${r.level}`, level: r.level };
    default: return { title: r.title || 'Topshiriq', subtitle: "O'qituvchidan", level: r.level };
  }
}

export async function buildLesson(taskRow) {
  const task = hydrate(taskRow);
  const info = describeTask(task);
  let stages;
  switch (task.type) {
    case 'grammar': {
      const u = unitById[task.ref.unit];
      if (!u) throw new Error('unit not found');
      stages = grammarStages(task, u, task.ref.mode || 'new');
      break;
    }
    case 'vocab': stages = await vocabStages(task, await vocabSelection(task)); break;
    case 'srs': stages = await srsStages(task); break;
    case 'reading': stages = await readingStages(task); break;
    case 'listening': stages = await listeningStages(task); break;
    case 'speaking': stages = await speakingStages(task); break;
    case 'writing': stages = await writingStages(task); break;
    default: stages = customStages(task);
  }
  return { task, info, stages };
}

export const publicStage = (s) => ({ key: s.key, title: s.title, minutes: s.minutes, skill: s.skill, ...s.pub });
