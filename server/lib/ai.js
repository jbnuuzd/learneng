// High level AI helpers. Every function degrades to a rule-based fallback when Gemini is unavailable,
// and returns `ai: true/false` so the UI can be honest about how something was assessed.
import { aiEnabled, generateJSON, generateText, AiError } from './gemini.js';
import { clamp, LEVELS, cefrToAbility, ieltsToAbility } from './scale.js';
import { wordCount, norm } from './grading.js';

export const TONES = {
  positive: { label: "Rag'batlantiruvchi (pozitiv)", uz: "Yutuqlarga asosiy urg'u beriladi, xatolar qisqa va muloyim eslatiladi." },
  neutral: { label: 'Neytral', uz: "Yutuq va kamchiliklar teng, xolis aytiladi." },
  negative: { label: "Qat'iy (negativ)", uz: "Xato va kamchiliklarga asosiy urg'u beriladi, yutuq qisqa tilga olinadi." },
};
export const isTone = (t) => t in TONES;

const TONE_RULES = {
  positive: 'TONE = POSITIVE. Start with sincere praise. Spend most of the text on what the learner did well and on progress. Mention at most 2 mistakes, briefly and kindly, with the fix. End with encouragement.',
  neutral: 'TONE = NEUTRAL. Be objective and balanced: state strengths and weaknesses with equal weight, no emotional language, no exaggeration.',
  negative: 'TONE = NEGATIVE (strict). Be a demanding, critical teacher: focus mainly on mistakes, weaknesses and repeated patterns, and say clearly what must be fixed. Mention achievements in one short sentence only. Stay respectful and professional: criticise the work, never the person; no insults or sarcasm about the learner themselves.',
};
const SYS = (tone, level) => `You are an expert English teacher for Uzbek-speaking learners (CEFR level ${level || 'unknown'}). Write feedback in simple Uzbek (Latin script); keep English examples and corrections in English. ${TONE_RULES[tone] || TONE_RULES.neutral}`;

const lvl = (x) => (LEVELS.includes(String(x).toUpperCase()) ? String(x).toUpperCase() : 'B1');
const num = (x, lo, hi, d = 0) => (Number.isFinite(Number(x)) ? clamp(Number(x), lo, hi) : d);
const str = (x, max = 1200) => String(x ?? '').slice(0, max);
const arr = (x, n = 8, max = 300) => (Array.isArray(x) ? x.slice(0, n).map((s) => str(typeof s === 'string' ? s : JSON.stringify(s), max)) : []);

// ---------- feedback for objective stages ---------------------------------
function fallbackFeedback({ tone, score, mistakes, title }) {
  const pct = Math.round(score * 100);
  const m = mistakes.slice(0, 3).map((x) => `• ${x}`).join('\n');
  if (tone === 'positive') {
    return pct >= 70
      ? `Barakalla! "${title}" bo'yicha ${pct}% natija — ajoyib ish! Siz mavzuni yaxshi tushunyapsiz.${m ? `\nKichik nuqtalar, ularni osongina tuzatasiz:\n${m}` : ''}\nShu tarzda davom eting!`
      : `Harakatingiz uchun rahmat! ${pct}% — bu yaxshi boshlanish. Har bir xato o'rganish imkoniyati.${m ? `\nKeyingi safar shularga e'tibor bering:\n${m}` : ''}\nNazariyani yana bir ko'rib chiqsangiz, natija tez yaxshilanadi.`;
  }
  if (tone === 'negative') {
    return pct >= 85
      ? `Natija: ${pct}%. Yaxshi, ammo bu hali mukammal emas.${m ? `\nXatolar:\n${m}` : ''}\nEng yuqori darajaga intiling.`
      : `Natija: ${pct}% — bu yetarli emas. Bu daraja bilan maqsadga erishib bo'lmaydi.${m ? `\nQuyidagi xatolar takrorlanmasligi kerak:\n${m}` : ''}\nNazariyani qayta o'qing va mashqni yana bajaring.`;
  }
  return `Natija: ${pct}%.${m ? `\nXatolar:\n${m}` : '\nXato topilmadi.'}\nTavsiya: xatolarni nazariya bilan solishtiring.`;
}

export async function objectiveFeedback({ title, tone, level, score, items, topic }) {
  const mistakes = items.filter((x) => !x.ok).map((x) => `${x.q ? x.q + ' → ' : ''}siz: "${x.given ?? '—'}", to'g'ri: "${x.expectedText ?? x.expected}"`);
  if (aiEnabled()) {
    try {
      const prompt = `Exercise: "${title}" (${topic || 'general'}). Score: ${Math.round(score * 100)}%.
Wrong answers (question → learner answer vs correct):
${mistakes.slice(0, 12).join('\n') || '(none)'}
Write 3–6 short sentences of feedback, explain the likely reason of the mistakes (the rule), and give one concrete next step. No markdown headings.`;
      const t = await generateText(prompt, { system: SYS(tone, level), temperature: 0.6 });
      return { text: t.slice(0, 1500), ai: true };
    } catch { /* fall back */ }
  }
  return { text: fallbackFeedback({ tone, score, mistakes, title }), ai: false };
}

// ---------- AI re-check of typed answers that failed exact matching ----------------
export async function recheck(entries) {
  // entries: [{ q, given, expected }]; returns boolean[] (true = acceptable answer)
  if (!aiEnabled() || !entries.length) return entries.map(() => false);
  try {
    const r = await generateJSON(`Each entry has an exercise prompt, the model answer and the learner's answer.
Decide if the learner's answer is ALSO fully correct (grammatically right, same meaning, follows the instruction). Be strict about grammar, tolerant about harmless variants (contractions, punctuation, capitalisation, synonyms).
Return JSON: {"ok":[true|false, ...]} in the same order.
<student_text>${JSON.stringify(entries.slice(0, 20))}</student_text>`, { temperature: 0 });
    return entries.map((_, i) => r.ok?.[i] === true);
  } catch { return entries.map(() => false); }
}

// ---------- sentence level grading (make a sentence / translate) ----------------
export async function gradeSentences({ kind, items, tone, level, focus }) {
  // items: [{ prompt, word?, reference?, answer }]
  const fallback = () => {
    const res = items.map((it) => {
      const a = String(it.answer || '').trim();
      const words = wordCount(a);
      let ok;
      if (kind === 'make') ok = words >= 4 && norm(a).includes(norm(it.word).split(' ')[0]) && /^[A-Z]/.test(a);
      else {
        const ref = new Set(norm(it.reference).split(' ')), got = norm(a).split(' ').filter(Boolean);
        const hit = got.filter((w) => ref.has(w)).length;
        ok = got.length > 0 && hit / Math.max(ref.size, got.length) >= 0.7;
      }
      return { ok, score: ok ? 1 : 0, comment: ok ? 'Qabul qilindi (oflayn tekshiruv).' : 'Namunaviy javobga yetarlicha mos kelmadi (oflayn tekshiruv).', correction: it.reference || '' };
    });
    const score = res.reduce((s, r) => s + r.score, 0) / (res.length || 1);
    return { items: res, score, ai: false, feedback: fallbackFeedback({ tone, score, title: kind === 'make' ? "Gap tuzish" : 'Tarjima', mistakes: res.filter((r) => !r.ok).map((r, i) => `${i + 1}-gap: ${r.correction || ''}`) }) };
  };
  if (!aiEnabled()) return fallback();
  try {
    const task = kind === 'make'
      ? 'The learner had to write ONE correct, natural English sentence that uses the given word/phrase.'
      : 'The learner had to translate the Uzbek sentence into English. A reference translation is given, but other correct translations are fine.';
    const r = await generateJSON(`${task}
Grade each item: score 0..1 (1 = fully correct and natural; 0.5 = understandable with errors; 0 = wrong/missing), a short Uzbek comment, and a corrected English version.
Then write overall feedback (3–6 sentences).
Return JSON: {"items":[{"score":0..1,"comment":"...","correction":"..."}],"feedback":"..."}
<student_text>${JSON.stringify(items.slice(0, 12))}</student_text>`, { system: SYS(tone, level) + (focus ? ` Target grammar: ${focus}.` : ''), temperature: 0.3 });
    const out = items.map((_, i) => {
      const x = r.items?.[i] || {};
      const s = num(x.score, 0, 1, 0);
      return { ok: s >= 0.7, score: s, comment: str(x.comment, 300), correction: str(x.correction, 300) };
    });
    return { items: out, score: out.reduce((s, x) => s + x.score, 0) / (out.length || 1), ai: true, feedback: str(r.feedback, 1500) };
  } catch { return fallback(); }
}

// ---------- writing ----------------------------------------------------------
export async function gradeWriting({ prompt, text, words = [0, 9999], level, tone, focus, mini = false }) {
  const wc = wordCount(text);
  const heuristic = () => {
    const sentences = (text.match(/[.!?]+/g) || []).length || 1;
    const uniq = new Set(norm(text).split(' ')).size;
    const ttr = uniq / Math.max(wc, 1);
    const avg = wc / sentences;
    let a = 10 + Math.min(wc, 200) / 200 * 35 + clamp(ttr - 0.4, 0, 0.4) * 50 + clamp(avg - 6, 0, 14) * 1.2;
    if (wc < words[0] * 0.6) a -= 8;
    a = clamp(a, 5, 80);
    const score = clamp(wc / Math.max(words[0], 1), 0, 1) * 0.7 + 0.3 * clamp(ttr * 1.4, 0, 1);
    return { ai: false, ability: a, cefr: null, band: null, score, criteria: null, strengths: [], weaknesses: wc < words[0] ? [`Matn qisqa: ${wc} ta so'z (kamida ${words[0]} ta kerak).`] : [], corrections: [], usedFocus: null,
      feedback: fallbackFeedback({ tone, score, title: 'Yozma ish', mistakes: wc < words[0] ? [`Hajm yetarli emas (${wc}/${words[0]} so'z).`] : [] }) + "\n(Eslatma: AI ulanmagan, shuning uchun bu taxminiy tekshiruv.)" };
  };
  if (wc < 3) return { ...heuristic(), score: 0, feedback: 'Matn kiritilmadi.' };
  if (!aiEnabled()) return heuristic();
  try {
    const r = await generateJSON(`Assess this English writing by an Uzbek-speaking learner (expected level: ${level || 'unknown'}).
Task given to the learner: ${prompt}
Required length: ${words[0]}–${words[1]} words; the learner wrote ${wc} words.
${focus ? `The learner was asked to practise this grammar: ${focus}. Say whether they used it correctly.` : ''}
Rate with IELTS-style criteria (each 1–9): task (task response), coherence, lexical, grammar.
Return JSON:
{"cefr":"A1..C2","band":1..9 (0.5 steps, overall),"score":0..100 (how well the task was done for a learner at this level),
 "criteria":{"task":n,"coherence":n,"lexical":n,"grammar":n},
 "strengths":["Uzbek bullet",...max 4],"weaknesses":["Uzbek bullet",...max 4],
 "corrections":[{"original":"...","corrected":"...","why":"Uzbek short rule"}...max ${mini ? 4 : 6}],
 "usedFocus":true|false|null,
 "feedback":"4–8 sentences, in the required tone"}
<student_text>${str(text, 6000)}</student_text>`, { system: SYS(tone, level), temperature: 0.2 });
    const cefr = lvl(r.cefr), band = num(r.band, 1, 9, 5);
    return {
      ai: true, cefr, band, ability: (cefrToAbility(cefr) + ieltsToAbility(band)) / 2, score: num(r.score, 0, 100, 50) / 100,
      criteria: { task: num(r.criteria?.task, 1, 9, band), coherence: num(r.criteria?.coherence, 1, 9, band), lexical: num(r.criteria?.lexical, 1, 9, band), grammar: num(r.criteria?.grammar, 1, 9, band) },
      strengths: arr(r.strengths, 4), weaknesses: arr(r.weaknesses, 4),
      corrections: (Array.isArray(r.corrections) ? r.corrections : []).slice(0, 6).map((c) => ({ original: str(c.original, 300), corrected: str(c.corrected, 300), why: str(c.why, 300) })),
      usedFocus: typeof r.usedFocus === 'boolean' ? r.usedFocus : null, feedback: str(r.feedback, 2500),
    };
  } catch { return heuristic(); }
}

// ---------- speaking (single answer) ---------------------------------------------
export async function gradeSpeaking({ prompt, wav, level, tone, focus }) {
  if (!aiEnabled() || !wav) {
    return { ai: false, transcript: null, ability: null, cefr: null, band: null, score: null, strengths: [], weaknesses: [], corrections: [],
      feedback: "Nutq yozib olindi, lekin sun'iy intellekt ulanmagani uchun baholanmadi. API kaliti qo'shilgach, speaking avtomatik baholanadi." };
  }
  try {
    const r = await generateJSON(`The audio contains a learner (Uzbek speaker, expected level ${level || 'unknown'}) answering a speaking task.
Task: ${prompt}
${focus ? `Grammar to practise: ${focus}.` : ''}
First transcribe exactly what the learner said (keep their errors). Then assess like an IELTS examiner: fluency & coherence, lexical resource, grammatical range & accuracy, pronunciation (1–9 each).
Return JSON:
{"transcript":"...","cefr":"A1..C2","band":1..9,"score":0..100,
 "criteria":{"fluency":n,"lexical":n,"grammar":n,"pronunciation":n},
 "strengths":["Uzbek",..max 4],"weaknesses":["Uzbek",..max 4],
 "corrections":[{"original":"...","corrected":"...","why":"Uzbek short"}..max 5],
 "pronunciation_tips":["Uzbek tip about specific sounds/words",..max 3],
 "usedFocus":true|false|null,
 "feedback":"4–8 sentences in the required tone"}
If the audio is silent or not English, say so in feedback and give score 0.`, { system: SYS(tone, level), audio: { mime: 'audio/wav', data: wav }, temperature: 0.2, timeout: 90000 });
    const cefr = lvl(r.cefr), band = num(r.band, 1, 9, 5);
    return {
      ai: true, transcript: str(r.transcript, 3000), cefr, band, ability: (cefrToAbility(cefr) + ieltsToAbility(band)) / 2, score: num(r.score, 0, 100, 50) / 100,
      criteria: { fluency: num(r.criteria?.fluency, 1, 9, band), lexical: num(r.criteria?.lexical, 1, 9, band), grammar: num(r.criteria?.grammar, 1, 9, band), pronunciation: num(r.criteria?.pronunciation, 1, 9, band) },
      strengths: arr(r.strengths, 4), weaknesses: arr(r.weaknesses, 4),
      corrections: (Array.isArray(r.corrections) ? r.corrections : []).slice(0, 5).map((c) => ({ original: str(c.original, 300), corrected: str(c.corrected, 300), why: str(c.why, 300) })),
      tips: arr(r.pronunciation_tips, 3), usedFocus: typeof r.usedFocus === 'boolean' ? r.usedFocus : null, feedback: str(r.feedback, 2500),
    };
  } catch (e) {
    return { ai: false, transcript: null, ability: null, score: null, strengths: [], weaknesses: [], corrections: [], feedback: `AI baholash vaqtincha ishlamadi (${e instanceof AiError ? e.message : 'xato'}). Keyinroq urinib ko'ring.` };
  }
}

// ---------- content generation ------------------------------------------------------
const WORDS_FOR = { A1: '60–90', A2: '100–150', B1: '170–230', B2: '240–320', C1: '300–400', C2: '350–450' };

export async function generateReading({ level, topic, grounded = false, source = null }) {
  const prompt = `Create an ORIGINAL English reading text and 5 multiple-choice comprehension questions for CEFR ${level}.
Topic: ${topic || 'any interesting everyday or academic topic'}. Length: ${WORDS_FOR[level] || '200'} words. IELTS-style: vary question types (detail, main idea, inference, vocabulary in context, writer's attitude for B2+).
${grounded ? 'Use Google Search to find a real, recent news/science/culture item on the topic and base the text on its facts. Rewrite it fully in your own words (do not copy), and put the real source name and URL in "source".' : ''}
${source ? `<source_text>${str(source, 8000)}</source_text>\nBase the text on the source above, simplified/adapted to ${level}.` : ''}
Return JSON: {"title":"...","text":"paragraphs separated by \\n\\n","source":"name/URL or null","questions":[{"q":"...","o":["A","B","C","D"],"a":0..3}...5 items],"vocabulary":[{"w":"word","uz":"Uzbek"}...6 items]}`;
  const r = await generateJSON(prompt, { grounded, temperature: 0.8, timeout: 90000 });
  return normalizeReading(r, level, topic);
}
function normalizeReading(r, level, topic) {
  const qs = (Array.isArray(r.questions) ? r.questions : []).slice(0, 8).map((x) => ({
    d: level, q: str(x.q, 400), o: arr(x.o, 4, 200), a: num(x.a, 0, 3, 0),
  })).filter((x) => x.q && x.o.length >= 2 && x.a < x.o.length);
  if (!r.text || qs.length < 3) throw new AiError('failed', 'Reading kontenti noto\'g\'ri formatda');
  return { level, topic: topic || 'general', title: str(r.title, 120) || 'Reading', text: str(r.text, 6000), source: r.source ? str(r.source, 300) : null, q: qs, vocabulary: (Array.isArray(r.vocabulary) ? r.vocabulary : []).slice(0, 8).map((v) => ({ w: str(v.w, 60), uz: str(v.uz, 100) })) };
}

export async function generateListening({ level, topic, format = 'monologue', source = null }) {
  const two = format === 'dialogue';
  const prompt = `Create an ORIGINAL English listening script and 5 multiple-choice questions for CEFR ${level}, topic: ${topic || 'daily life'}.
Format: ${two ? 'a natural dialogue between exactly two named speakers (e.g. "Anna" and "Tom")' : format === 'lecture' ? 'a short lecture / talk by one speaker' : 'a monologue by one speaker (radio talk, announcement or podcast style)'}.
Length: ${WORDS_FOR[level] || '200'} words. Make it sound spoken (contractions, discourse markers). Questions test gist, detail and inference; the answer must be in the script.
${source ? `<source_text>${str(source, 8000)}</source_text>\nBase the script on this transcript (adapt/shorten it to the level; keep facts).` : ''}
Return JSON: {"title":"...","speakers":[${two ? '"Name1","Name2"' : '"Name"'}],"lines":[["Speaker","what they say"],...],"questions":[{"q":"...","o":["A","B","C","D"],"a":0..3}...5]}`;
  const r = await generateJSON(prompt, { temperature: 0.8, timeout: 90000 });
  const lines = (Array.isArray(r.lines) ? r.lines : []).slice(0, 60).map((l) => [str(l[0], 40) || 'Speaker', str(l[1], 1200)]).filter((l) => l[1]);
  const qs = (Array.isArray(r.questions) ? r.questions : []).slice(0, 8).map((x) => ({ d: level, q: str(x.q, 400), o: arr(x.o, 4, 200), a: num(x.a, 0, 3, 0) })).filter((x) => x.q && x.o.length >= 2 && x.a < x.o.length);
  if (!lines.length || qs.length < 3) throw new AiError('failed', 'Listening kontenti noto\'g\'ri formatda');
  const speakers = [...new Set(lines.map((l) => l[0]))];
  return { level, topic: topic || 'general', title: str(r.title, 120) || 'Listening', speakers, lines, q: qs };
}

export async function generateVocab({ topic, level, n = 40, exclude = [] }) {
  const r = await generateJSON(`List ${n} useful English vocabulary items for IELTS/CEFR ${level} learners on the topic "${topic}": mix of nouns, verbs, adjectives, collocations and phrasal verbs that actually appear in IELTS reading/listening/speaking/writing. Avoid these already-learned words: ${exclude.slice(0, 200).join(', ') || '(none)'}.
Return JSON: {"words":[{"w":"word","pos":"n|v|adj|adv|phr v|phr","uz":"accurate Uzbek translation (Latin script)","ex":"natural example sentence at ${level}"}...]}`, { temperature: 0.5, timeout: 90000 });
  const words = (Array.isArray(r.words) ? r.words : []).map((x) => ({ w: str(x.w, 60).trim(), pos: str(x.pos, 12), uz: str(x.uz, 100), ex: str(x.ex, 250), topic, level })).filter((x) => x.w && x.uz && x.ex);
  if (words.length < Math.min(10, n)) throw new AiError('failed', "Lug'at noto'g'ri formatda");
  return words;
}

export async function generatePrompt({ kind, level, topic, focus }) {
  const r = await generateJSON(`Create one ${kind === 'writing' ? 'IELTS-style writing task (essay/email/report)' : 'speaking task (IELTS-style question or cue card)'} for CEFR ${level}, topic: ${topic || 'general'}.${focus ? ` The learner should practise: ${focus}.` : ''}
Return JSON: {"prompt":"...", ${kind === 'writing' ? '"minWords":n,"maxWords":n' : '"seconds":n'}}`, { temperature: 0.9 });
  if (!r.prompt) throw new AiError('failed', 'Prompt yaratilmadi');
  return kind === 'writing'
    ? { level, topic, prompt: str(r.prompt, 800), words: [num(r.minWords, 30, 400, 100), num(r.maxWords, 40, 500, 160)] }
    : { level, topic, prompt: str(r.prompt, 800), seconds: num(r.seconds, 20, 180, 60) };
}

// ---------- pronunciation (one read-aloud sentence) -----------------------------------
export async function gradePronunciation({ sentence, wav, tone, level, focus }) {
  if (!aiEnabled() || !wav) {
    return { ai: false, score: null, words: [], issues: [], feedback: "Talaffuzni baholash uchun sun'iy intellekt (Gemini kaliti) kerak." };
  }
  const r = await generateJSON(`The audio is an Uzbek-speaking learner (level ${level || 'unknown'}) reading this sentence aloud:
"${sentence}"
${focus ? `Sounds being practised: ${focus}.` : ''}
Judge ONLY pronunciation (individual sounds, word stress, rhythm/intonation) — not grammar. Be fair: a non-native accent is fine if it is easy to understand.
Return JSON: {"transcript":"what you actually heard","score":0..100,
"words":[{"w":"each word of the target sentence in order","s":"good"|"ok"|"bad"}],
"issues":[{"word":"...","said":"how it sounded (approximate, e.g. 'wery')","tip":"short Uzbek tip how to produce it correctly"}] (max 4, only real problems),
"feedback":"3-5 sentences in the required tone"}
If the audio is silent or not English, give score 0 and say so.`, { system: SYS(tone, level), audio: { mime: 'audio/wav', data: wav }, temperature: 0.2, timeout: 60000, fast: true });
  const target = sentence.split(/\s+/);
  const given = Array.isArray(r.words) ? r.words : [];
  const words = target.map((w, i) => ({ w, s: ['good', 'ok', 'bad'].includes(given[i]?.s) ? given[i].s : 'ok' }));
  return {
    ai: true, score: num(r.score, 0, 100, 50), transcript: str(r.transcript, 400), words,
    issues: (Array.isArray(r.issues) ? r.issues : []).slice(0, 4).map((x) => ({ word: str(x.word, 40), said: str(x.said, 60), tip: str(x.tip, 250) })),
    feedback: str(r.feedback, 1200),
  };
}
