import { q } from './db.js';
import { HttpError } from './http.js';

const DAY = 86400000;
const ITER = 100000;                                  // Workers' PBKDF2 maximum
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
  return `pbkdf2$${ITER}$${hex(salt)}$${hex(await derive(pw, salt, ITER))}`;
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
  const s = await q.get('SELECT user_id, expires_at FROM sessions WHERE token=?', token);
  if (!s) return null;
  if (s.expires_at < Date.now()) { await q.run('DELETE FROM sessions WHERE token=?', token); return null; }
  return (await q.get('SELECT id,email,name,role,teacher_id,invite_code,feedback_tone,created_at FROM users WHERE id=?', s.user_id)) ?? null;
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
