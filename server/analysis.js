// "Can this learner really reach the goal?" — deterministic model + (optional) Gemini narrative.
import { q, unj } from './lib/db.js';
import { aiEnabled, generateJSON } from './lib/gemini.js';
import { abilities, overall, SKILLS, SKILL_UZ } from './lib/progress.js';
import { goalAbility, clamp, describe, toCefr, levelIndex } from './lib/scale.js';
import { diffDays, addDays } from './lib/dates.js';
import { activePlan, NEW_WORDS_PER_DAY, HOURS_PER_LEVEL, POINTS_PER_LEVEL } from './planner.js';
import { units } from './lib/content.js';
import { cacheGet, cacheSet } from './lib/content.js';
import { hashStr } from './lib/rng.js';

// Rough receptive vocabulary sizes per level (internal planning model, approximate).
const VOCAB_PTS = [[0, 300], [8, 500], [25, 1500], [45, 2750], [65, 5000], [83, 8000], [95, 12000], [100, 15000]];
const interp = (pts, x) => { for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); } return pts.at(-1)[1]; };
const inverse = (pts, y) => { for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return x0 + ((y - y0) / (y1 - y0)) * (x1 - x0); } return 100; };
export const vocabForAbility = (a) => Math.round(interp(VOCAB_PTS, a));
const RETENTION = 0.6;   // share of newly met words that stays active after spaced forgetting

export async function analyseGoal(userId, today) {
  const goal = q.get('SELECT * FROM goals WHERE user_id=?', userId);
  const plan = activePlan(userId);
  if (!goal || !plan) return { ready: false, reason: 'Avval maqsad belgilang va traektoriya yarating.' };
  const ab = abilities(userId);
  const cur = overall(ab);
  if (cur == null) return { ready: false, reason: 'Avval diagnostik testni topshiring.' };
  const target = goalAbility(goal);
  const start = plan.meta.start || goal.start_date;
  const daysTotal = diffDays(goal.start_date, goal.deadline);
  const daysLeft = Math.max(0, diffDays(today, goal.deadline));

  // adherence so far
  const past = q.get("SELECT SUM(minutes) planned, SUM(CASE WHEN status='done' THEN minutes ELSE 0 END) done, COUNT(*) n, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) nd FROM tasks WHERE user_id=? AND date<?", userId, today);
  const adherence = past.n >= 5 ? clamp(past.done / Math.max(past.planned, 1), 0.2, 1) : 0.8;
  const fut = q.get("SELECT SUM(minutes) m, COUNT(*) n FROM tasks WHERE user_id=? AND date>=? AND status!='done'", userId, today);
  const futureHours = (fut.m || 0) / 60;
  const futureEffective = futureHours * adherence;
  const learnedWords = q.get('SELECT COUNT(*) n FROM learned_words WHERE user_id=?', userId).n;
  const futureNewWords = q.get("SELECT COUNT(*) n FROM tasks WHERE user_id=? AND type='vocab' AND date>=? AND status!='done'", userId, today).n * NEW_WORDS_PER_DAY;

  // hours model
  const gapPoints = Math.max(0, target - cur);
  const requiredHours = Math.max(20, (gapPoints / POINTS_PER_LEVEL) * HOURS_PER_LEVEL);
  const hoursRatio = futureEffective / requiredHours;
  const gainByHours = (futureEffective / HOURS_PER_LEVEL) * POINTS_PER_LEVEL;

  // vocabulary model
  const vocabNow = vocabForAbility(cur);
  const vocabTarget = vocabForAbility(target);
  const vocabProjected = vocabNow + futureNewWords * RETENTION;
  const vocabCoverage = clamp((vocabProjected - vocabNow) / Math.max(vocabTarget - vocabNow, 1), 0, 1.5);
  const vocabLimitedAbility = inverse(VOCAB_PTS, vocabProjected);

  // grammar coverage
  const ci = levelIndex(toCefr(cur)), ti = levelIndex(goal.target_cefr);
  const neededUnits = units.filter((u) => levelIndex(u.level) >= ci && levelIndex(u.level) <= ti);
  const scheduledUnits = new Set((plan.meta.units || []));
  const grammarCoverage = neededUnits.length ? neededUnits.filter((u) => scheduledUnits.has(u.id) || q.get("SELECT 1 FROM tasks WHERE user_id=? AND type='grammar' AND status='done' AND ref_json LIKE ?", userId, `%"${u.id}"%`)).length / neededUnits.length : 1;

  const predicted = clamp(0.65 * (cur + gainByHours) + 0.35 * Math.max(cur, Math.min(cur + gainByHours, vocabLimitedAbility + 8)), 0, 100);
  const shortfallHours = Math.max(0, requiredHours - futureEffective);
  const hoursPerDay = plan.meta.hoursPerDay || goal.hours_per_day;
  const extraDaysNeeded = daysLeft ? Math.ceil(shortfallHours / (hoursPerDay * adherence)) : null;
  const neededHoursPerDay = daysLeft ? Math.ceil((requiredHours / (daysLeft * adherence)) * 2) / 2 : null;

  // skill table
  const skills = SKILLS.map((s) => {
    const a = ab[s], t = target;
    const planned = q.get("SELECT SUM(minutes) m FROM tasks WHERE user_id=? AND date>=? AND status!='done' AND type=?", userId, today, s === 'vocab' ? 'vocab' : s).m || 0;
    return { skill: s, name: SKILL_UZ[s], current: a == null ? null : describe(a), gap: a == null ? null : Math.round(Math.max(0, t - a)), plannedHours: Math.round(planned / 6) / 10 };
  });

  const score =
    0.45 * clamp(hoursRatio, 0, 1.2) / 1.2 + 0.3 * clamp(vocabCoverage, 0, 1) + 0.15 * grammarCoverage + 0.1 * clamp(adherence, 0, 1);
  // map the composite to a probability-like figure; deliberately conservative
  const chance = Math.round(clamp(1 / (1 + Math.exp(-(score - 0.62) * 9)), 0.02, 0.97) * 100);
  const verdict = hoursRatio >= 1 && vocabCoverage >= 0.8 ? 'realistic' : hoursRatio >= 0.6 && vocabCoverage >= 0.5 ? 'stretch' : 'unrealistic';

  const metrics = {
    ready: true, today, daysTotal, daysLeft, target: { cefr: goal.target_cefr, ielts: goal.target_ielts }, current: describe(cur),
    predicted: describe(predicted), chance, verdict, adherence: Math.round(adherence * 100),
    hours: { required: Math.round(requiredHours), futurePlanned: Math.round(futureHours), futureEffective: Math.round(futureEffective), perDay: hoursPerDay, neededPerDay: neededHoursPerDay, shortfall: Math.round(shortfallHours), extraDaysNeeded },
    vocabulary: { newWordsPerDay: NEW_WORDS_PER_DAY, meetsDailyTarget: NEW_WORDS_PER_DAY >= 50, learnedSoFar: learnedWords, plannedNew: futureNewWords, retention: RETENTION, now: vocabNow, projected: Math.round(vocabProjected), target: vocabTarget, coverage: Math.round(vocabCoverage * 100) },
    grammar: { unitsNeeded: neededUnits.length, unitsCovered: Math.round(grammarCoverage * neededUnits.length), coverage: Math.round(grammarCoverage * 100), contentCeiling: levelIndex(goal.target_cefr) > 4 ? 'C1' : null },
    skills,
    suggestedDeadline: extraDaysNeeded ? addDays(goal.deadline, extraDaysNeeded) : null,
    milestone: { cefr: describe(predicted).cefr, ielts: describe(predicted).ielts },
    disclaimer: "Bu — ichki model asosidagi taxminiy baho (CEFR bo'yicha o'rtacha o'zlashtirish tezligi va lug'at hajmiga tayanadi). Haqiqiy IELTS natijasi shaxsiy qobiliyat, muntazamlik va imtihon strategiyasiga ham bog'liq; kafolat emas.",
  };

  // AI narrative (cached per day + plan + metric fingerprint)
  const fp = hashStr(JSON.stringify([metrics.chance, metrics.hours, metrics.vocabulary.projected, metrics.skills.map((s) => s.current?.ability)]));
  const key = `analysis:${userId}:${today}:${fp}`;
  let narrative = cacheGet(key);
  if (!narrative && aiEnabled()) {
    try {
      narrative = await generateJSON(`You are a senior IELTS/CEFR study-planning advisor. Based ONLY on these computed metrics, judge whether the learner can reach the goal and advise concretely.
Be honest: do not promise results; if the goal is unrealistic say so and propose a realistic alternative (longer deadline, higher daily hours, intermediate milestone). Mention the 50-new-words-per-day requirement and whether retention is a risk.
Write in simple Uzbek (Latin). Return JSON: {"verdict":"realistic|stretch|unrealistic","summary":"3-5 sentences","risks":["..." max 4],"actions":["concrete, measurable step" max 6],"skillPriorities":[{"skill":"grammar|vocab|reading|listening|writing|speaking","why":"short","minutesPerDay":n}]}
Metrics: ${JSON.stringify(metrics)}`, { temperature: 0.3 });
      narrative.ai = true; cacheSet(key, 'analysis', narrative);
    } catch { narrative = null; }
  }
  if (!narrative) narrative = fallbackNarrative(metrics);
  return { ...metrics, narrative };
}

function fallbackNarrative(m) {
  const v = m.verdict;
  const summary = v === 'realistic'
    ? `Rejadagi ish hajmi (taxminan ${m.hours.futureEffective} soat) maqsad uchun zarur ~${m.hours.required} soatdan yetarli. Muntazam bajarsangiz, ${m.target.cefr} / IELTS ${m.target.ielts} darajasiga erishish imkoniyati yuqori (~${m.chance}%).`
    : v === 'stretch'
      ? `Maqsad qiyin, lekin mumkin: zarur ~${m.hours.required} soat, siz bajarishi mumkin bo'lgan ~${m.hours.futureEffective} soat. Hozirgi reja bilan kutilayotgan daraja ${m.predicted.cefr} / IELTS ${m.predicted.ielts}. Kuniga ${m.hours.neededPerDay} soat yoki muddatni uzaytirish tavsiya etiladi.`
      : `Hozirgi reja bilan ${m.target.cefr} / IELTS ${m.target.ielts} ga erishish real emas: zarur ~${m.hours.required} soat, reja bo'yicha samarali ~${m.hours.futureEffective} soat. Kutilayotgan daraja: ${m.predicted.cefr} / IELTS ${m.predicted.ielts}. Muddatni uzaytiring yoki oraliq maqsad (${m.predicted.cefr}) belgilang.`;
  const risks = [];
  if (m.vocabulary.coverage < 80) risks.push(`Lug'at yetishmovchiligi: reja bo'yicha ${m.vocabulary.plannedNew} ta yangi so'z (eslab qolish ~${Math.round(m.vocabulary.retention * 100)}%) maqsad lug'atining faqat ${m.vocabulary.coverage}% ini qoplaydi.`);
  if (m.adherence < 70) risks.push(`Bajarish darajasi past (${m.adherence}%). Muntazamlik natijaga hal qiluvchi ta'sir qiladi.`);
  if (m.hours.shortfall > 0) risks.push(`Soatlar yetishmayapti: taxminan ${m.hours.shortfall} soat.`);
  if (m.grammar.contentCeiling) risks.push("Platformadagi tayyor grammatika darslari C1 gacha; C2 uchun qo'shimcha AI-kontent kerak.");
  const actions = [];
  if (m.hours.neededPerDay && m.hours.neededPerDay > m.hours.perDay) actions.push(`Kunlik vaqtni ${m.hours.perDay} dan ${m.hours.neededPerDay} soatgacha oshiring.`);
  if (m.suggestedDeadline) actions.push(`Yoki muddatni ${m.suggestedDeadline} gacha uzaytiring.`);
  actions.push("Har kuni 52 ta yangi so'zni takrorlash bilan mustahkamlang (ertasi kuni testda qaytariladi).");
  const weakest = [...m.skills].filter((s) => s.current).sort((a, b) => b.gap - a.gap)[0];
  if (weakest) actions.push(`Eng katta tafovut: ${weakest.name} (${weakest.current.cefr}). Trenajyorda qo'shimcha mashq qiling.`);
  return { verdict: v, summary, risks, actions, skillPriorities: m.skills.filter((s) => s.current).sort((a, b) => b.gap - a.gap).slice(0, 3).map((s) => ({ skill: s.skill, why: `Maqsaddan ${s.gap} ball orqada`, minutesPerDay: 20 })), ai: false };
}
