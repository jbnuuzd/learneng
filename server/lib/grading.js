// Objective (rule based) grading. AI based grading lives in ai.js.
const CONTRACTIONS = [
  [/\bwon't\b/g, 'will not'], [/\bcan't\b/g, 'can not'], [/\bcannot\b/g, 'can not'], [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], [/'m\b/g, ' am'], [/'re\b/g, ' are'], [/'ll\b/g, ' will'], [/'ve\b/g, ' have'],
];
// Lower-case, unify quotes, drop punctuation, expand common contractions (so "don't" == "do not").
export function norm(s) {
  let t = String(s ?? '').toLowerCase().replace(/[’‘`´]/g, "'");
  for (const [re, to] of CONTRACTIONS) t = t.replace(re, to);
  return t.replace(/[.,!?;:"“”()\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}
export const acceptable = (given, expected) => {
  const g = norm(given);
  return g.length > 0 && (Array.isArray(expected) ? expected : [expected]).some((e) => norm(e) === g);
};
export const wordCount = (s) => (String(s || '').trim().match(/[A-Za-zÀ-ɏ'’-]+/g) || []).length;

// stage.key: for 'choice' -> [correctIndex...], 'text' -> [[acceptable...]...], 'match' -> [rightIndex...]
export function gradeObjective(kind, key, answers, questions = []) {
  const items = key.map((exp, i) => {
    const given = answers?.[i];
    let ok = false, expected;
    if (kind === 'choice') { ok = Number(given) === exp; expected = exp; }
    else if (kind === 'match') { ok = Number(given) === exp; expected = exp; }
    else { ok = acceptable(given, exp); expected = exp[0]; }
    return { i, ok, given: given ?? null, expected, q: questions[i] ?? null };
  });
  const correct = items.filter((x) => x.ok).length;
  return { correct, total: items.length, score: items.length ? correct / items.length : 0, items };
}
