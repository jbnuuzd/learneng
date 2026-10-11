// Content access layer: static seed content + AI generated content cached in SQLite.
import g1 from '../content/grammar1.js';
import g2 from '../content/grammar2.js';
import g3 from '../content/grammar3.js';
import { topics as seedTopics, general as seedGeneral } from '../content/vocab.js';
import { readingPool, listeningPool, writingPool, speakingPool } from '../content/pools.js';
import { q, j, unj } from './db.js';
import { aiEnabled } from './gemini.js';
import { generateVocab, generateReading, generateListening, generatePrompt } from './ai.js';
import { levelIndex, LEVELS } from './scale.js';
import { hashStr } from './rng.js';

export const units = [...g1, ...g2, ...g3].map((u, i) => ({ ...u, order: i }));
export const unitById = Object.fromEntries(units.map((u) => [u.id, u]));

// IELTS-style topic catalogue. Seed topics ship with 40 words; the rest are generated (and cached) with Gemini.
export const topicCatalog = [
  ...seedTopics.map((t) => ({ id: t.id, title: t.title, level: t.level, seed: true })),
  { id: 'media', title: 'Media va reklama', level: 'B2' },
  { id: 'crime-law', title: 'Jinoyat va qonun', level: 'B2' },
  { id: 'sport-leisure', title: "Sport va bo'sh vaqt", level: 'B1' },
  { id: 'housing-cities', title: 'Uy-joy va shaharlar', level: 'B1' },
  { id: 'transport', title: 'Transport', level: 'B1' },
  { id: 'science', title: 'Fan va kashfiyotlar', level: 'B2' },
  { id: 'culture-arts', title: "Madaniyat va san'at", level: 'B2' },
  { id: 'society', title: 'Jamiyat va munosabatlar', level: 'B2' },
  { id: 'globalisation', title: 'Globallashuv', level: 'C1' },
  { id: 'government', title: 'Hukumat va siyosat', level: 'C1' },
  { id: 'money-economy', title: 'Pul va iqtisodiyot', level: 'C1' },
  { id: 'language-communication', title: 'Til va muloqot', level: 'B2' },
];
export const topicById = Object.fromEntries(topicCatalog.map((t) => [t.id, t]));

const getCached = (key) => unj(q.get('SELECT json FROM generated_content WHERE key=?', key)?.json);
const setCached = (key, kind, val) =>
  q.run('INSERT INTO generated_content(key,kind,json) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json', key, kind, j(val));

// ---------- vocabulary ------------------------------------------------------
export function topicWordPool(topicId) {
  const seed = seedTopics.find((t) => t.id === topicId)?.words || [];
  const gen = getCached('vocab:' + topicId) || [];
  const seen = new Set(), out = [];
  for (const w of [...seed, ...gen]) { const k = w.w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
  return out;
}
export function generalWordPool(level) {
  const gen = getCached('vocab:general:' + level) || [];
  const seen = new Set(), out = [];
  for (const w of [...(seedGeneral[level] || []), ...gen]) { const k = w.w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
  return out;
}
export async function growTopic(topicId, extra = 40) {
  const t = topicById[topicId];
  if (!t || !aiEnabled()) return false;
  const have = topicWordPool(topicId);
  const words = await generateVocab({ topic: t.title + ' (' + t.id.replace(/-/g, ' ') + ')', level: t.level, n: extra, exclude: have.map((w) => w.w) });
  const prev = getCached('vocab:' + topicId) || [];
  setCached('vocab:' + topicId, 'vocab', [...prev, ...words.map((w) => ({ ...w, topic: topicId }))]);
  return true;
}
export async function growGeneral(level, extra = 40) {
  if (!aiEnabled()) return false;
  const have = generalWordPool(level);
  const words = await generateVocab({ topic: 'high-frequency academic and everyday words', level, n: extra, exclude: have.map((w) => w.w) });
  const prev = getCached('vocab:general:' + level) || [];
  setCached('vocab:general:' + level, 'vocab', [...prev, ...words.map((w) => ({ ...w, topic: 'general' }))]);
  return true;
}

// ---------- reading / listening / prompts ------------------------------------
function nearestByLevel(pool, level, salt) {
  const li = levelIndex(level);
  const sorted = [...pool].sort((a, b) => Math.abs(levelIndex(a.level) - li) - Math.abs(levelIndex(b.level) - li));
  const best = Math.abs(levelIndex(sorted[0].level) - li);
  const cands = sorted.filter((x) => Math.abs(levelIndex(x.level) - li) === best);
  return cands[hashStr(String(salt)) % cands.length];
}
export const pickReading = (level, salt) => nearestByLevel(readingPool, level, salt);
export const pickListening = (level, salt) => nearestByLevel(listeningPool, level, salt);
export const pickWriting = (level, salt) => nearestByLevel(writingPool, level, salt);
export const pickSpeaking = (level, salt) => nearestByLevel(speakingPool, level, salt);

// Returns content for a task, creating (and caching) it the first time. `key` makes it stable on reopen.
export async function readingFor(key, { level, topic, grounded = false, source = null }, salt) {
  const cached = getCached(key);
  if (cached) return cached;
  let c;
  if (aiEnabled()) { try { c = { ...(await generateReading({ level, topic, grounded, source })), generated: true }; } catch { /* fallback */ } }
  if (!c) c = { ...pickReading(level, salt), generated: false };
  setCached(key, 'reading', c);
  return c;
}
export async function listeningFor(key, { level, topic, format = 'monologue', source = null }, salt) {
  const cached = getCached(key);
  if (cached) return cached;
  let c;
  if (aiEnabled()) { try { c = { ...(await generateListening({ level, topic, format, source })), generated: true }; } catch { /* fallback */ } }
  if (!c) c = { ...pickListening(level, salt), generated: false };
  setCached(key, 'listening', c);
  return c;
}
export async function promptFor(key, kind, { level, topic, focus }, salt) {
  const cached = getCached(key);
  if (cached) return cached;
  let c;
  if (aiEnabled()) { try { c = { ...(await generatePrompt({ kind, level, topic, focus })), generated: true }; } catch { /* fallback */ } }
  if (!c) c = { ...(kind === 'writing' ? pickWriting(level, salt) : pickSpeaking(level, salt)), generated: false };
  setCached(key, kind + '-prompt', c);
  return c;
}
export const cacheGet = getCached;
export const cacheSet = setCached;
export { LEVELS };
