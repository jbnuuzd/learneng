import crypto from 'node:crypto';
import { q } from './db.js';
import { HttpError } from './http.js';

const DAY = 86400000;
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
export function verifyPassword(pw, stored) {
  const [s, h] = stored.split(':');
  const hash = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(h, 'hex'));
}
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  q.run('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', token, userId, Date.now() + 30 * DAY);
  return token;
}
export function userFromToken(token) {
  if (!token) return null;
  const s = q.get('SELECT user_id, expires_at FROM sessions WHERE token=?', token);
  if (!s) return null;
  if (s.expires_at < Date.now()) { q.run('DELETE FROM sessions WHERE token=?', token); return null; }
  return q.get('SELECT id,email,name,role,teacher_id,invite_code,feedback_tone,created_at FROM users WHERE id=?', s.user_id);
}
export const sessionCookie = (token, maxAge = 30 * 86400) =>
  `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

export function requireRole(user, role) {
  if (!user) throw new HttpError(401, 'Tizimga kiring');
  if (role && user.role !== role) throw new HttpError(403, "Bu amal uchun ruxsat yo'q");
}
export function newInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Tiny in-memory limiter for expensive AI endpoints.
const hits = new Map();
export function rateLimit(userId, key, max, windowMs = 60000) {
  const k = key + ':' + userId, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Juda ko'p so'rov. Bir daqiqadan so'ng urinib ko'ring.");
  arr.push(now); hits.set(k, arr);
}
