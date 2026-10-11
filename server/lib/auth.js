import { q } from './db.js';
import { HttpError } from './http.js';
import { getEnv } from './env.js';

const DAY = 86400000;
const iterations = () => Math.min(100000, Math.max(1000, Number(getEnv().PBKDF2_ITERATIONS) || 100000));   // 100000 = Workers' maximum; lower only if the free plan's CPU limit trips
const enc = new TextEncoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));
const b64url = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derive(pw, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
export async function hashPassword(pw) {
  const salt = rand(16);
  const it = iterations();
  return `pbkdf2$${it}$${hex(salt)}$${hex(await derive(pw, salt, it))}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, iter, salt, hash] = stored.split('$');
  if (alg !== 'pbkdf2') return false;
  const got = await derive(pw, unhex(salt), Number(iter));
  const want = unhex(hash);
  let diff = got.length ^ want.length;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ (want[i] ?? 0);   // constant-time compare
  return diff === 0;
}
export async function createSession(userId) {
  const token = b64url(rand(32));
  await q.run('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)', token, userId, Date.now() + 30 * DAY);
  return token;
}
export async function userFromToken(token) {
  if (!token) return null;
  const row = await q.get('SELECT u.id,u.email,u.name,u.role,u.teacher_id,u.invite_code,u.feedback_tone,u.created_at, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?', token);
  if (!row) return null;
  if (row.expires_at < Date.now()) { await q.run('DELETE FROM sessions WHERE token=?', token); return null; }
  const { expires_at, ...user } = row;
  return user;
}
export const sessionCookie = (token, maxAge = 30 * 86400, secure = true) =>
  `sid=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

export const newInviteCode = () => hex(rand(4)).toUpperCase();

// Best-effort per-isolate limiter for expensive AI endpoints (not a hard global limit).
const hits = new Map();
export function rateLimit(userId, key, max, windowMs = 60000) {
  const k = key + ':' + userId, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, "Juda ko'p so'rov. Bir daqiqadan so'ng urinib ko'ring.");
  arr.push(now); hits.set(k, arr);
}
