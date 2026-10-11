// IELTS-style scoring helpers (approximate; the real exam's conversion tables differ slightly by test version).
const RAW_TO_BAND = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [0, 1]];
// correct/total is scaled to a 40-question test, as in the real Listening and Reading papers.
export function rawToBand(correct, total) {
  if (!total) return null;
  const raw40 = Math.round((correct / total) * 40);
  return RAW_TO_BAND.find(([min]) => raw40 >= min)[1];
}
// IELTS rounding: nearest half band (x.25 -> x.5, x.75 -> next whole band)
export const roundBand = (x) => Math.round(x * 2) / 2;
export const overallBand = (bands) => { const v = bands.filter((b) => b != null); return v.length ? roundBand(v.reduce((a, b) => a + b, 0) / v.length) : null; };
// Writing: Task 2 carries twice the weight of Task 1.
export const writingBand = (t1, t2) => (t1 != null && t2 != null ? roundBand((t1 + 2 * t2) / 3) : (t2 ?? t1));

export const SECTION_PLAN = {
  mini: { listening: { minutes: 15, clips: 2 }, reading: { minutes: 25, passages: 2 }, writing: { minutes: 40 }, speaking: { minutes: 8 } },
  full: { listening: { minutes: 30, clips: 4 }, reading: { minutes: 60, passages: 3 }, writing: { minutes: 60 }, speaking: { minutes: 14 } },
};
export const SECTION_ORDER = ['listening', 'reading', 'writing', 'speaking'];
