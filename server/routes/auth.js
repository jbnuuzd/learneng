import { q } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { hashPassword, verifyPassword, createSession, sessionCookie, newInviteCode, rateLimit } from '../lib/auth.js';
import { cfg } from '../lib/env.js';
import { aiEnabled, aiState, runAiChecks } from '../lib/gemini.js';
import { TONES } from '../lib/ai.js';
import { effectiveTone, currentLevel } from '../lib/progress.js';
import { activePlan } from '../planner.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function meState(user, date) {
  const diag = await q.get('SELECT status FROM diagnostics WHERE user_id=? ORDER BY id DESC LIMIT 1', user.id);
  const isStudent = user.role === 'student';
  const goal = isStudent ? await q.get('SELECT user_id FROM goals WHERE user_id=?', user.id) : null;
  const teacher = user.teacher_id ? await q.get('SELECT id,name,email FROM users WHERE id=?', user.teacher_id) : null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, inviteCode: user.invite_code || undefined, feedbackTone: user.feedback_tone, teacher: teacher ?? null },
    today: { tone: isStudent ? await effectiveTone(user.id, date) : null, date },
    tones: TONES,
    ai: aiEnabled(),
    state: isStudent ? { diagnostic: diag?.status || 'none', hasGoal: !!goal, hasPlan: !!(await activePlan(user.id)), level: await currentLevel(user.id) } : null,
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
  r.post('/api/ai/test', async ({ user }) => {
    if (user.role !== 'teacher') throw new HttpError(403, "Faqat o'qituvchilar uchun");
    rateLimit(user.id, 'aitest', 6);
    if (!aiEnabled()) return { key: false, hint: "GEMINI_API_KEY Secret sifatida qo'shilmagan." };
    return runAiChecks();
  });
}
