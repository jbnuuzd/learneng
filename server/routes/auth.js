import { q, tx } from '../lib/db.js';
import { bad, HttpError } from '../lib/http.js';
import { hashPassword, verifyPassword, createSession, sessionCookie, newInviteCode } from '../lib/auth.js';
import { cfg } from '../lib/env.js';
import { aiEnabled } from '../lib/gemini.js';
import { TONES, isTone } from '../lib/ai.js';
import { effectiveTone, currentLevel } from '../lib/progress.js';
import { activePlan } from '../planner.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function meState(user, date) {
  const diag = q.get("SELECT status FROM diagnostics WHERE user_id=? ORDER BY id DESC LIMIT 1", user.id);
  const goal = user.role === 'student' ? q.get('SELECT * FROM goals WHERE user_id=?', user.id) : null;
  const teacher = user.teacher_id ? q.get('SELECT id,name,email FROM users WHERE id=?', user.teacher_id) : null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, inviteCode: user.invite_code || undefined, feedbackTone: user.feedback_tone, teacher },
    today: { tone: user.role === 'student' ? effectiveTone(user.id, date) : null, date },
    tones: TONES,
    ai: aiEnabled(),
    state: user.role === 'student' ? { diagnostic: diag?.status || 'none', hasGoal: !!goal, hasPlan: !!activePlan(user.id), level: currentLevel(user.id) } : null,
  };
}

export function registerAuth(r) {
  r.post('/api/auth/register', ({ body, res, date }) => {
    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = body.role === 'teacher' ? 'teacher' : 'student';
    if (name.length < 2) throw bad("Ismingizni kiriting");
    if (!EMAIL.test(email)) throw bad("Email noto'g'ri");
    if (password.length < 8) throw bad("Parol kamida 8 ta belgi bo'lsin");
    if (q.get('SELECT 1 FROM users WHERE email=?', email)) throw bad("Bu email bilan ro'yxatdan o'tilgan");
    if (role === 'teacher' && cfg.teacherCode && body.teacherSignupCode !== cfg.teacherCode) throw new HttpError(403, "O'qituvchi ro'yxatdan o'tish kodi noto'g'ri");
    let teacherId = null;
    if (role === 'student' && body.inviteCode) {
      const t = q.get("SELECT id FROM users WHERE invite_code=? AND role='teacher'", String(body.inviteCode).trim().toUpperCase());
      if (!t) throw bad("O'qituvchi kodi topilmadi");
      teacherId = t.id;
    }
    const id = tx(() => {
      let code = null;
      if (role === 'teacher') { do { code = newInviteCode(); } while (q.get('SELECT 1 FROM users WHERE invite_code=?', code)); }
      return q.run('INSERT INTO users(email,name,pass_hash,role,teacher_id,invite_code) VALUES(?,?,?,?,?,?)', email, name, hashPassword(password), role, teacherId, code).lastInsertRowid;
    });
    const token = createSession(id);
    res.setHeader('set-cookie', sessionCookie(token));
    const user = q.get('SELECT * FROM users WHERE id=?', id);
    return meState(user, date);
  }, { auth: false });

  r.post('/api/auth/login', ({ body, res, date }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const u = q.get('SELECT * FROM users WHERE email=?', email);
    if (!u || !verifyPassword(String(body.password || ''), u.pass_hash)) throw new HttpError(401, "Email yoki parol noto'g'ri");
    res.setHeader('set-cookie', sessionCookie(createSession(u.id)));
    return meState(u, date);
  }, { auth: false });

  r.post('/api/auth/logout', ({ req, res }) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (sid) q.run('DELETE FROM sessions WHERE token=?', decodeURIComponent(sid));
    res.setHeader('set-cookie', sessionCookie('', 0));
    return { ok: true };
  }, { auth: false });

  r.get('/api/me', ({ user, date }) => (user ? meState(q.get('SELECT * FROM users WHERE id=?', user.id), date) : { user: null }), { auth: false });

  r.post('/api/me/teacher', ({ user, body }) => {
    if (user.role !== 'student') throw new HttpError(403, "Faqat o'quvchilar uchun");
    const t = q.get("SELECT id FROM users WHERE invite_code=? AND role='teacher'", String(body.inviteCode || '').trim().toUpperCase());
    if (!t) throw bad("O'qituvchi kodi topilmadi");
    q.run('UPDATE users SET teacher_id=? WHERE id=?', t.id, user.id);
    return { ok: true };
  });

  r.get('/api/ai/status', () => ({ enabled: aiEnabled(), textModel: cfg.textModel, ttsModel: cfg.ttsModel }));
}
