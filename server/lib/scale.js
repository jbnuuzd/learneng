// Ability scale 0..100  <->  CEFR level  <->  IELTS band.
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_MIN = { A1: 0, A2: 15, B1: 35, B2: 55, C1: 75, C2: 92 };
// Typical item difficulty (centre of each CEFR band) on the same scale.
export const LEVEL_DIFF = { A1: 8, A2: 25, B1: 45, B2: 65, C1: 83, C2: 95 };
const IELTS_PTS = [[0, 1], [15, 2.5], [35, 4], [55, 5.5], [75, 7], [92, 8.5], [100, 9]];

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function toCefr(a) {
  a = clamp(a, 0, 100);
  let r = 'A1';
  for (const l of LEVELS) if (a >= CEFR_MIN[l]) r = l;
  return r;
}
export function toIelts(a) {
  a = clamp(a, 0, 100);
  for (let i = 1; i < IELTS_PTS.length; i++) {
    const [x0, y0] = IELTS_PTS[i - 1], [x1, y1] = IELTS_PTS[i];
    if (a <= x1) return Math.round((y0 + ((a - x0) / (x1 - x0)) * (y1 - y0)) * 2) / 2;
  }
  return 9;
}
export function ieltsToAbility(b) {
  b = clamp(b, 1, 9);
  for (let i = 1; i < IELTS_PTS.length; i++) {
    const [x0, y0] = IELTS_PTS[i - 1], [x1, y1] = IELTS_PTS[i];
    if (b <= y1) return x0 + ((b - y0) / (y1 - y0)) * (x1 - x0);
  }
  return 100;
}
// Lowest ability that counts as being "at" this level (target = reach the level).
export const cefrToAbility = (l) => (CEFR_MIN[l] ?? 0) + (l === 'C2' ? 2 : 3);
export const levelIndex = (l) => Math.max(0, LEVELS.indexOf(l));
export const levelFromAbility = (a) => toCefr(a);

// 1-PL style maximum-likelihood ability estimate with a guessing floor.
// items: [{ d: difficulty(0..100), ok: boolean, c?: guess }]
export function estimateAbility(items) {
  if (!items.length) return 0;
  const S = 9;
  let best = 0, bestLL = -Infinity;
  for (let a = 0; a <= 100; a += 0.5) {
    let ll = 0;
    for (const it of items) {
      const c = it.c ?? 0.25;
      const p = clamp(c + (1 - c) / (1 + Math.exp(-(a - it.d) / S)), 1e-6, 1 - 1e-6);
      ll += it.ok ? Math.log(p) : Math.log(1 - p);
    }
    // weak prior toward the middle keeps tiny samples sane
    ll += -((a - 45) ** 2) / (2 * 40 * 40);
    if (ll > bestLL) { bestLL = ll; best = a; }
  }
  return Math.round(best * 10) / 10;
}
// Evidence from a graded exercise at content difficulty d with score fraction s.
export const evidenceFromScore = (d, s) => clamp(d + (s - 0.7) * 30, 0, 100);

export function describe(a) {
  return { ability: Math.round(a * 10) / 10, cefr: toCefr(a), ielts: toIelts(a) };
}

// Target ability of a goal: the stricter of the CEFR level and the IELTS band the learner asked for.
export const goalAbility = (g) => Math.max(cefrToAbility(g.target_cefr), ieltsToAbility(g.target_ielts ?? 1));
