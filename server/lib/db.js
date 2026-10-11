// Thin async wrapper over Cloudflare D1 (SQLite). Schema lives in /migrations.
import { getEnv } from './env.js';

const DB = () => {
  const db = getEnv().DB;
  if (!db) throw new Error('D1 binding "DB" is missing');
  return db;
};
const clean = (p) => p.map((v) => (v === undefined ? null : v));
const prep = (sql, p) => DB().prepare(sql).bind(...clean(p));

export const q = {
  get: async (sql, ...p) => (await prep(sql, p).first()) ?? undefined,
  all: async (sql, ...p) => (await prep(sql, p).all()).results ?? [],
  run: async (sql, ...p) => {
    const r = await prep(sql, p).run();
    return { changes: r.meta?.changes ?? 0, lastInsertRowid: r.meta?.last_row_id };
  },
};
// Prepared statement for batch(); D1 runs a batch atomically (single implicit transaction).
export const stmt = (sql, ...p) => prep(sql, p);
export const batch = (stmts) => (stmts.length ? DB().batch(stmts) : Promise.resolve([]));
export const j = (x) => JSON.stringify(x);
export const unj = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
