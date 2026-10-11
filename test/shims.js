// Test doubles for Cloudflare bindings, so the real Worker code runs under plain Node.
import { DatabaseSync } from 'node:sqlite';

export function createD1(schemaSql) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(schemaSql);
  const run = (sql, p) => { const r = db.prepare(sql).run(...p); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; };
  const check = (p) => { if (p.some((v) => v === undefined)) throw new Error('D1_TYPE_ERROR: Type \'undefined\' not supported for value \'undefined\''); if (p.length > 100) throw new Error('too many bound parameters'); };
  const make = (sql, p = []) => ({
    bind: (...params) => make(sql, params),
    first: async () => { check(p); return db.prepare(sql).get(...p) ?? null; },
    all: async () => { check(p); return { results: db.prepare(sql).all(...p) }; },
    run: async () => { check(p); return run(sql, p); },
    _exec: () => { check(p); return /^\s*select/i.test(sql) ? { results: db.prepare(sql).all(...p) } : run(sql, p); },
  });
  return {
    prepare: (sql) => make(sql),
    batch: async (stmts) => { db.exec('BEGIN'); try { const out = stmts.map((s) => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}

export function createR2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, value, opts) {
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(await new Response(value).arrayBuffer());
      m.set(key, { bytes, opts });
    },
    async get(key) {
      const e = m.get(key);
      if (!e) return null;
      return { size: e.bytes.length, body: new Response(e.bytes).body, arrayBuffer: async () => e.bytes.buffer };
    },
    async delete(key) { m.delete(key); },
  };
}
