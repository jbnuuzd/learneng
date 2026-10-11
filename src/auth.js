'use strict';
const crypto = require('node:crypto');

const SESSION_DAYS = 14;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, got);
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = Date.now() + SESSION_DAYS * 864e5;
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token, userId, exp);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

function userFromToken(db, token) {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id, u.login, u.role, u.full_name, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token=?').run(token);
    return null;
  }
  return { id: row.id, login: row.login, role: row.role, full_name: row.full_name };
}

/**
 * Admin hisobi faqat muhit o'zgaruvchilaridan olinadi (ADMIN_LOGIN / ADMIN_PASSWORD).
 * Berilmasa — tasodifiy parol yaratiladi va BIR MARTA konsolga chiqariladi.
 */
function ensureAdmin(db, env = process.env, log = console.log) {
  const login = env.ADMIN_LOGIN || 'admin';
  let password = env.ADMIN_PASSWORD;
  const existing = db.prepare("SELECT id, pass_hash FROM users WHERE role='admin'").get();
  if (!password) {
    if (existing) return;
    password = crypto.randomBytes(9).toString('base64url');
    log(`\n[ADMIN] ADMIN_PASSWORD berilmagan. Vaqtinchalik admin hisobi yaratildi:\n        login: ${login}\n        parol: ${password}\n        (Doimiy parol uchun ADMIN_LOGIN va ADMIN_PASSWORD muhit o'zgaruvchilarini o'rnating.)\n`);
  }
  if (existing) {
    if (env.ADMIN_PASSWORD && !verifyPassword(password, existing.pass_hash)) {
      db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(password), existing.id);
    }
    if (env.ADMIN_LOGIN) db.prepare('UPDATE users SET login=? WHERE id=?').run(login, existing.id);
  } else {
    db.prepare("INSERT INTO users(login,pass_hash,role,full_name) VALUES(?,?, 'admin','Administrator')")
      .run(login, hashPassword(password));
  }
}

const attempts = new Map();
function rateLimited(key, max = 8, windowMs = 10 * 60e3) {
  const now = Date.now();
  const arr = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  attempts.set(key, arr);
  if (arr.length >= max) return true;
  arr.push(now);
  return false;
}
function clearAttempts(key) { attempts.delete(key); }

module.exports = { hashPassword, verifyPassword, createSession, userFromToken, ensureAdmin, rateLimited, clearAttempts };
