import { q } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { hashPassword, verifyPassword, createSession, sessionCookie, newInviteCode, rateLimit } from '../lib/auth.js';
import { cfg } from '../lib/env.js';
import { aiEnabled, aiState, runAiChecks, loadDbKeys, keyStatus, allKeys } from '../lib/gemini.js';
import { TONES } from '../lib/ai.js';
import { effectiveTone, currentLevel } from '../lib/progress.js';
import { activePlan } from '../planner.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function meState(user, date) {
  const isStudent = user.role === 'student';
  const [diag, goal, teacher, tone, plan, level] = await Promise.all([
    q.get('SELECT status FROM diagnostics WHERE user_id=? ORDER BY id DESC LIMIT 1', user.id),
    isStudent ? q.get('SELECT user_id FROM goals WHERE user_id=?', user.id) : null,
    user.teacher_id ? q.get('SELECT id,name,email FROM users WHERE id=?', user.teacher_id) : null,
    isStudent ? effectiveTone(user.id, date) : null,
    isStudent ? activePlan(user.id) : null,
    isStudent ? currentLevel(user.id) : null,
  ]);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, inviteCode: user.invite_code || undefined, feedbackTone: user.feedback_tone, teacher: teacher ?? null },
    today: { tone, date },
    tones: TONES,
    ai: aiEnabled(),
    state: isStudent ? { diagnostic: diag?.status || 'none', hasGoal: !!goal, hasPlan: !!plan, level } : null,
  };
}

export function registerAuth(r) {
  r.post('/api/auth/register', async ({ body, setCookie, date }) => {
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role === 'teacher' ? 'teacher' : 'student';
    if (name.length < 2) throw bad('Ismingizni kiriting');
    if (!EMAIL.test(email)) throw bad("Email noto'g'ri");
    if (password.length < 8) throw bad("Parol kamida 8 ta belgi bo'lsin");
    if (await q.get('SELECT 1 FROM users WHERE email=?', email)) throw bad("Bu email bilan ro'yxatdan o'tilgan");
    if (role === 'teacher' && cfg.teacherCode && body.teacherSignupCode !== cfg.teacherCode) throw new HttpError(403, "O'qituvchi ro'yxatdan o'tish kodi noto'g'ri");
    let teacherId = null;
    if (role === 'student' && body.inviteCode) {
      const t = await q.get("SELECT id FROM users WHERE invite_code=? AND role='teacher'", String(body.inviteCode).trim().toUpperCase());
      if (!t) throw bad("O'qituvchi kodi topilmadi");
      teacherId = t.id;
    }
    const hash = await hashPassword(password);
    let id = null;
    for (let attempt = 0; attempt < 5 && id == null; attempt++) {   // invite codes are random; retry on the (rare) UNIQUE clash
      try { id = (await q.run('INSERT INTO users(email,name,pass_hash,role,teacher_id,invite_code) VALUES(?,?,?,?,?,?)', email, name, hash, role, teacherId, role === 'teacher' ? newInviteCode() : null)).lastInsertRowid; }
      catch (e) { if (!/UNIQUE/i.test(String(e.message)) || /users\.email/i.test(String(e.message))) throw e; }
    }
    if (id == null) throw new HttpError(500, 'Kod yaratib bo\'lmadi');
    setCookie(sessionCookie(await createSession(id)));
    return meState(await q.get('SELECT * FROM users WHERE id=?', id), date);
  }, { auth: false });

  r.post('/api/auth/login', async ({ request, body, setCookie, date }) => {
    const email = String(body.email || '').trim().toLowerCase();
    rateLimit(`${request.headers.get('cf-connecting-ip') || 'local'}:${email}`, 'login', 10);   // slows password guessing per isolate
    const u = await q.get('SELECT * FROM users WHERE email=?', email);
    if (!u || !(await verifyPassword(String(body.password || ''), u.pass_hash))) throw new HttpError(401, "Email yoki parol noto'g'ri");
    setCookie(sessionCookie(await createSession(u.id)));
    return meState(u, date);
  }, { auth: false });

  r.post('/api/auth/logout', async ({ request, setCookie }) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1];
    if (sid) await q.run('DELETE FROM sessions WHERE token=?', decodeURIComponent(sid));
    setCookie(sessionCookie('', 0));
    return { ok: true };
  }, { auth: false });

  r.get('/api/me', async ({ user, date }) => (user ? meState(await q.get('SELECT * FROM users WHERE id=?', user.id), date) : { user: null }), { auth: false });

  r.post('/api/me/password', async ({ user, body, setCookie }) => {
    const u = await q.get('SELECT pass_hash FROM users WHERE id=?', user.id);
    if (!(await verifyPassword(String(body.current || ''), u.pass_hash))) throw new HttpError(403, "Joriy parol noto'g'ri");
    const next = String(body.next || '');
    if (next.length < 8) throw bad("Yangi parol kamida 8 ta belgi bo'lsin");
    await q.run('UPDATE users SET pass_hash=? WHERE id=?', await hashPassword(next), user.id);
    await q.run('DELETE FROM sessions WHERE user_id=?', user.id);            // sign out everywhere, then keep this device signed in
    setCookie(sessionCookie(await createSession(user.id)));
    return { ok: true };
  });

  r.post('/api/me/teacher', async ({ user, body }) => {
    if (user.role !== 'student') throw new HttpError(403, "Faqat o'quvchilar uchun");
    const t = await q.get("SELECT id FROM users WHERE invite_code=? AND role='teacher'", String(body.inviteCode || '').trim().toUpperCase());
    if (!t) throw bad("O'qituvchi kodi topilmadi");
    await q.run('UPDATE users SET teacher_id=? WHERE id=?', t.id, user.id);
    return { ok: true };
  });

  r.get('/api/ai/status', async () => ({ enabled: aiEnabled(), textModel: aiState.models.text || cfg.textModel, ttsModel: aiState.models.tts || cfg.ttsModel, lastError: aiState.lastError, lastOkAt: aiState.lastOkAt }));
  // Teachers manage Gemini API keys here (stored in D1; only the last 4 characters are ever sent back).
  const keyList = async () => {
    const rows = await q.all('SELECT id, api_key, label, created_at FROM ai_keys ORDER BY id');
    const st = keyStatus();
    return { keys: [...st.filter((k) => k.source === 'secret').map((k) => ({ ...k, id: null })),
      ...rows.map((x) => ({ id: x.id, label: x.label, created: x.created_at, ...(st.find((k) => k.key === '…' + x.api_key.slice(-4)) || { key: '…' + x.api_key.slice(-4), cooling: 0 }), source: 'ui' }))] };
  };
  r.get('/api/ai/keys', async ({ user }) => { if (user.role !== 'teacher') throw new HttpError(403, "Faqat o'qituvchilar uchun"); await loadDbKeys(true); return keyList(); });
  r.post('/api/ai/keys', async ({ user, body }) => {
    if (user.role !== 'teacher') throw new HttpError(403, "Faqat o'qituvchilar uchun");
    rateLimit(user.id, 'aikey', 20);
    // tolerate quotes and a pasted "GEMINI_API_KEY=" prefix
    const keys = String(body.key || '').split(/[\s,;]+/).map((k) => k.replace(/^[A-Za-z_]+=/, '').replace(/^["'`]+|["'`]+$/g, '')).filter(Boolean);
    if (!keys.length || keys.length > 10) throw bad('Kalitni kiriting (bir vaqtda 10 tagacha)');
    const label = String(body.label || '').trim().slice(0, 40);
    let added = 0;
    for (const k of keys) {
      if (!/^[\x21-\x7e]{20,200}$/.test(k) && !/["'<>\\]/.test(k)) throw bad("Kalit shakli noto'g'ri (bo'sh joy yoki ortiqcha belgi bo'lmasin; kamida 20 belgi)");
      if (allKeys().includes(k)) continue;
      await q.run('INSERT OR IGNORE INTO ai_keys(api_key,label,added_by) VALUES(?,?,?)', k, label, user.id); added++;
    }
    await loadDbKeys(true);
    return { added, ...(await keyList()) };
  });
  r.delete('/api/ai/keys/:id', async ({ user, params }) => {
    if (user.role !== 'teacher') throw new HttpError(403, "Faqat o'qituvchilar uchun");
    await q.run('DELETE FROM ai_keys WHERE id=?', Number(params.id)); await loadDbKeys(true);
    return keyList();
  });
  r.post('/api/ai/test', async ({ user }) => {
    if (user.role !== 'teacher') throw new HttpError(403, "Faqat o'qituvchilar uchun");
    rateLimit(user.id, 'aitest', 6);
    if (!aiEnabled()) return { key: false, hint: "GEMINI_API_KEY Secret sifatida qo'shilmagan." };
    return runAiChecks();
  });
}
