// All dates are plain 'YYYY-MM-DD' strings (the learner's local calendar day).
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const toMs = (s) => Date.parse(s + 'T00:00:00Z');
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s, n) => fromMs(toMs(s) + n * 86400000);
export const diffDays = (a, b) => Math.round((toMs(b) - toMs(a)) / 86400000);
export function addMonths(s, n) {
  const d = new Date(toMs(s));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export const todayUTC = () => new Date().toISOString().slice(0, 10);
// Client sends its local date; trust it only if it is within a day of server UTC.
export function clientDate(s) {
  if (!isDate(s)) return todayUTC();
  return Math.abs(diffDays(todayUTC(), s)) <= 1 ? s : todayUTC();
}
