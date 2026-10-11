import { q } from './db.js';

// Achievements are derived from existing data (no extra storage): each has a threshold on a counter.
const DEFS = [
  ['streak', 'streak', [3, 7, 14, 30], (n) => `🔥 ${n} kun ketma-ket`],
  ['words', 'words', [50, 200, 500, 1000], (n) => `🔤 ${n} ta so'z`],
  ['tasks', 'tasks', [1, 10, 50, 150], (n) => `✅ ${n} ta topshiriq`],
  ['speaking', 'speaking', [1, 5, 20], (n) => `🎤 ${n} ta speaking suhbat`],
  ['mock', 'mock', [1, 3], (n) => `📝 ${n} ta mock test`],
];

export async function badgesFor(userId, stats) {
  const [sp, mk] = await Promise.all([
    q.get("SELECT COUNT(*) n FROM speaking_sessions WHERE user_id=? AND status='done'", userId),
    q.get("SELECT COUNT(*) n FROM mock_tests WHERE user_id=? AND status='done'", userId).catch(() => ({ n: 0 })),
  ]);
  const have = { streak: stats.streak, words: stats.wordsLearned, tasks: stats.tasksDone, speaking: sp?.n || 0, mock: mk?.n || 0 };
  const out = [];
  for (const [id, key, steps, label] of DEFS) {
    const earned = steps.filter((s) => have[key] >= s);
    const next = steps.find((s) => have[key] < s) ?? null;
    out.push(...earned.map((s) => ({ id: `${id}-${s}`, title: label(s), earned: true })));
    if (next) out.push({ id: `${id}-${next}`, title: label(next), earned: false, progress: Math.round((have[key] / next) * 100) });
  }
  return out;
}
