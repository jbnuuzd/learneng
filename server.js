'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { open, getSetting } = require('./src/db');
const auth = require('./src/auth');
const { seedAll } = require('./src/seed');
const ai = require('./src/ai');
const rec = require('./src/recommend');
const feeds = require('./src/feeds');
const planner = require('./src/planner');
const { knowledge } = require('./src/knowledge');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new HttpError(400, m);

// ---- Admin CRUD konfiguratsiyasi ----
const ENTITIES = {
  journals: { table: 'journals', order: 'name', cols: ['name', 'kind', 'issn', 'publisher', 'country', 'since_year', 'access', 'apc_usd', 'scopus_status', 'quartile', 'oak_status', 'impact_factor', 'wos', 'subjects', 'acceptance', 'review_weeks', 'official_url', 'scopus_url', 'oak_url', 'description', 'verified'], track: ['scopus_status', 'quartile', 'oak_status', 'impact_factor', 'access'] },
  directions: { table: 'directions', pk: 'code', order: 'code', cols: ['code', 'name', 'field_group', 'tags', 'hints'] },
  requirements: { table: 'requirements', order: 'degree, id', cols: ['degree', 'kind', 'title', 'min_count', 'description', 'source_url', 'verified'] },
  doc_templates: { table: 'doc_templates', order: 'id', cols: ['key', 'category', 'title', 'description', 'phase', 'required', 'directions', 'cancelled_from'] },
  quotes: { table: 'quotes', order: 'id', cols: ['author', 'text', 'note'] },
};
const INTS = new Set(['since_year', 'apc_usd', 'wos', 'acceptance', 'review_weeks', 'verified', 'min_count', 'required']);
const REALS = new Set(['impact_factor']);
function coerce(col, v) {
  if (v === '' || v == null) return INTS.has(col) || REALS.has(col) ? (['wos', 'verified', 'required', 'acceptance', 'min_count'].includes(col) ? (col === 'acceptance' ? 3 : 0) : null) : '';
  if (INTS.has(col)) { const n = parseInt(v, 10); if (Number.isNaN(n)) throw bad(`${col} butun son bo'lishi kerak`); return n; }
  if (REALS.has(col)) { const n = parseFloat(v); if (Number.isNaN(n)) throw bad(`${col} son bo'lishi kerak`); return n; }
  return String(v);
}

function dayNumber() { return Math.floor(Date.now() / 864e5); }

function createApp(db) {
  const routes = [];
  const route = (method, pattern, access, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), access, handler });

  // ---------- yordamchilar ----------
  function userContext(userId) {
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id=?').get(userId);
    if (!profile || !profile.direction_code) return { profile: null };
    const direction = db.prepare('SELECT * FROM directions WHERE code=?').get(profile.direction_code);
    const requirements = db.prepare('SELECT * FROM requirements WHERE degree=? ORDER BY id').all(profile.degree);
    const docTemplates = db.prepare('SELECT * FROM doc_templates ORDER BY id').all();
    const plan = planner.buildPlan({ months: profile.months, startMonth: profile.start_month, requirements, docTemplates, direction });
    const doneKeys = new Set(db.prepare('SELECT task_key FROM user_tasks WHERE user_id=? AND done=1').all(userId).map((r) => r.task_key));
    return { profile, direction, requirements, docTemplates, plan, doneKeys, progress: planner.progress(plan, doneKeys) };
  }

  function requirementStatus(ctx) {
    return ctx.requirements.map((r) => {
      const tasks = ctx.plan.months.flatMap((m) => m.tasks).filter((t) => t.reqId === r.id);
      const done = tasks.filter((t) => ctx.doneKeys.has(t.key)).length;
      return { ...r, planned: tasks.length, done };
    });
  }

  // ---------- Ommaviy ----------
  route('GET', '/api/meta', 'public', () => ({
    directions: db.prepare('SELECT code,name,field_group FROM directions ORDER BY field_group, code').all(),
    ai: ai.enabled(),
    notice: 'Platformadagi jurnal kvartillari, to‘lov shartlari va OAK talablari «tekshirilmagan» deb belgilangan namuna ma’lumotlar bo‘lishi mumkin. Rasmiy manbalar (scopus.com, scimagojr.com, oak.uz) bilan solishtiring.',
  }));

  route('GET', '/api/knowledge', 'public', () => knowledge);

  route('POST', '/api/register', 'public', (req, body, ctx) => {
    const login = String(body.login || '').trim().toLowerCase();
    const full = String(body.full_name || '').trim();
    const pw = String(body.password || '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(login)) throw bad("Login 3–32 belgi: lotin harflari, raqam, _ . - ");
    if (full.length < 3) throw bad("Ism-familiyani to'liq kiriting");
    if (pw.length < 8) throw bad("Parol kamida 8 belgidan iborat bo'lsin");
    if (db.prepare('SELECT 1 FROM users WHERE login=?').get(login)) throw bad('Bu login band');
    const r = db.prepare("INSERT INTO users(login,pass_hash,role,full_name) VALUES(?,?, 'user',?)").run(login, auth.hashPassword(pw), full);
    const s = auth.createSession(db, Number(r.lastInsertRowid));
    ctx.setCookie(s);
    return { ok: true, role: 'user' };
  });

  route('POST', '/api/login', 'public', (req, body, ctx) => {
    const login = String(body.login || '').trim().toLowerCase();
    const key = `${ctx.ip}|${login}`;
    if (auth.rateLimited(key)) throw new HttpError(429, "Juda ko'p urinish. Bir necha daqiqadan so'ng qayta urinib ko'ring.");
    const u = db.prepare('SELECT * FROM users WHERE login=?').get(login);
    const ok = u ? auth.verifyPassword(String(body.password || ''), u.pass_hash) : (auth.verifyPassword('x', auth.hashPassword('y')), false);
    if (!ok) throw new HttpError(401, "Login yoki parol noto'g'ri");
    auth.clearAttempts(key);
    ctx.setCookie(auth.createSession(db, u.id));
    return { ok: true, role: u.role };
  });

  route('POST', '/api/logout', 'public', (req, body, ctx) => {
    if (ctx.token) db.prepare('DELETE FROM sessions WHERE token=?').run(ctx.token);
    ctx.clearCookie();
    return { ok: true };
  });

  route('GET', '/api/me', 'public', (req, body, ctx) => ({ user: ctx.user }));

  // ---------- Foydalanuvchi ----------
  route('GET', '/api/profile', 'user', (req, body, ctx) => ({ profile: db.prepare('SELECT * FROM profiles WHERE user_id=?').get(ctx.user.id) || null }));

  route('PUT', '/api/profile', 'user', (req, body, ctx) => {
    const status = ['doctoral', 'independent', 'beginner'].includes(body.status) ? body.status : null;
    const degree = ['phd', 'dsc'].includes(body.degree) ? body.degree : 'phd';
    if (!status) throw bad('Maqomingizni tanlang');
    if (!db.prepare('SELECT 1 FROM directions WHERE code=?').get(body.direction_code)) throw bad("Tadqiqot yo'nalishini tanlang");
    const topic = String(body.topic || '').trim().slice(0, 500);
    if (topic.length < 5) throw bad('Ilmiy ish mavzusini kiriting');
    const months = parseInt(body.months, 10);
    if (!(months >= 1 && months <= 60)) throw bad("Muddat 1 dan 60 oygacha bo'lishi kerak");
    const start = /^\d{4}-\d{2}$/.test(body.start_month || '') ? body.start_month : planner.currentMonth();
    const prev = db.prepare('SELECT direction_code FROM profiles WHERE user_id=?').get(ctx.user.id);
    db.prepare(`INSERT INTO profiles(user_id,status,degree,direction_code,topic,months,start_month,updated_at) VALUES(?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET status=excluded.status, degree=excluded.degree, direction_code=excluded.direction_code, topic=excluded.topic, months=excluded.months, start_month=excluded.start_month, updated_at=datetime('now')`)
      .run(ctx.user.id, status, degree, body.direction_code, topic, months, start);
    if (prev && prev.direction_code !== body.direction_code) {
      // yo'nalish o'zgarsa, faqat BELGILANMAGAN va hech qachon flag qo'yilmagan tavsiyalar qayta hisoblanadi — eskilari saqlanadi
      db.prepare("DELETE FROM user_journals WHERE user_id=? AND flag='' AND note=''").run(ctx.user.id);
    }
    return { ok: true };
  });

  route('GET', '/api/dashboard', 'user', async (req, body, ctx) => {
    const uc = userContext(ctx.user.id);
    const quotes = db.prepare('SELECT * FROM quotes ORDER BY id').all();
    const quote = quotes.length ? quotes[(dayNumber() + ctx.user.id) % quotes.length] : null;
    if (!uc.profile) return { quote, needProfile: true, name: ctx.user.full_name };
    const idx = planner.currentIndex(uc.plan);
    const curMonth = uc.plan.months[Math.min(Math.max(idx, 0), uc.plan.months.length - 1)];
    const pending = uc.plan.months.flatMap((m) => m.tasks.map((t) => ({ ...t, month: m.label, monthIndex: m.index }))).filter((t) => !uc.doneKeys.has(t.key));
    const overdue = pending.filter((t) => t.monthIndex - 1 < idx);
    const next = overdue[0] || pending[0] || null;
    const end = planner.endDate(uc.plan);
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / 864e5);
    const day = new Date().toISOString().slice(0, 10);
    const mkey = `${day}:${uc.progress.pct}`;
    let m = db.prepare('SELECT text FROM motivations WHERE user_id=? AND day=?').get(ctx.user.id, mkey);
    if (!m) {
      const text = await ai.motivation({ name: ctx.user.full_name, progressPct: uc.progress.pct, daysLeft, topic: uc.profile.topic, doneTasks: uc.progress.tasksDone, totalTasks: uc.progress.tasksTotal, nextTask: next?.title });
      db.prepare('INSERT OR REPLACE INTO motivations(user_id,day,text) VALUES(?,?,?)').run(ctx.user.id, mkey, text);
      db.prepare('DELETE FROM motivations WHERE user_id=? AND day != ? AND day NOT LIKE ?').run(ctx.user.id, mkey, `${day}:%`);
      m = { text };
    }
    const alerts = [];
    const flagged = db.prepare("SELECT COUNT(*) c FROM user_journals WHERE user_id=? AND flag!=''").get(ctx.user.id).c;
    if (flagged) alerts.push({ level: 'red', text: `Tavsiya etilgan ${flagged} ta jurnalda o'zgarish aniqlangan (kvartil pasaygan yoki ro'yxatdan chiqqan). «Jurnallar» bo'limida ko'ring.` });
    if (overdue.length) alerts.push({ level: 'amber', text: `${overdue.length} ta vazifa rejadagi muddatdan kechikmoqda. Birinchisi: «${overdue[0].title}» (${overdue[0].month}).` });
    const docsLeft = pending.filter((t) => t.kind === 'doc' && !t.optional).length;
    if (docsLeft) alerts.push({ level: 'blue', text: `Himoya uchun ${docsLeft} ta majburiy hujjat/ishlanma hali tayyor emas. Hech narsa esdan chiqmasligi uchun «Hujjatlar» bo'limini kuzatib boring.` });
    return {
      name: ctx.user.full_name, quote, motivation: m.text, aiEnabled: ai.enabled(),
      progress: uc.progress, daysLeft, currentMonth: curMonth?.label, thisMonth: curMonth?.tasks.map((t) => ({ ...t, done: uc.doneKeys.has(t.key) })) || [],
      next, alerts, requirements: requirementStatus(uc), profile: uc.profile, direction: uc.direction,
    };
  });

  route('GET', '/api/plan', 'user', async (req, body, ctx) => {
    const uc = userContext(ctx.user.id);
    if (!uc.profile) return { needProfile: true };
    const idx = planner.currentIndex(uc.plan);
    const months = uc.plan.months.map((m) => ({ ...m, current: m.index - 1 === idx, tasks: m.tasks.map((t) => ({ ...t, done: uc.doneKeys.has(t.key) })) }));
    const reqs = requirementStatus(uc);
    const summary = reqs.map((r) => `${r.title}: ${r.min_count} ta`).join('; ');
    const advice = ai.enabled() ? await ai.ask('Siz ilmiy maslahatchisiz. Faqat o‘zbek tilida qisqa yozing.', `Yo'nalish: ${uc.direction?.name}. Mavzu: ${uc.profile.topic}. Muddat: ${uc.profile.months} oy. Talablar: ${summary}. 3 ta qisqa amaliy maslahat bering.`, { maxTokens: 350 }) : null;
    return { months, warnings: uc.plan.warnings, progress: uc.progress, requirements: reqs, profile: uc.profile, advice, startMonth: uc.plan.startMonth };
  });

  route('POST', '/api/plan/task', 'user', (req, body, ctx) => {
    const uc = userContext(ctx.user.id);
    if (!uc.profile) throw bad('Avval profilni to‘ldiring');
    const key = String(body.key || '');
    const valid = uc.plan.months.some((m) => m.tasks.some((t) => t.key === key));
    if (!valid) throw bad('Noma’lum vazifa');
    db.prepare(`INSERT INTO user_tasks(user_id,task_key,done,done_at) VALUES(?,?,?,CASE WHEN ?=1 THEN datetime('now') END)
      ON CONFLICT(user_id,task_key) DO UPDATE SET done=excluded.done, done_at=excluded.done_at`).run(ctx.user.id, key, body.done ? 1 : 0, body.done ? 1 : 0);
    return { ok: true, progress: userContext(ctx.user.id).progress };
  });

  route('GET', '/api/documents', 'user', (req, body, ctx) => {
    const uc = userContext(ctx.user.id);
    if (!uc.profile) return { needProfile: true };
    const dirTags = new Set(String(uc.direction?.tags || '').split(',').filter(Boolean));
    const monthOf = new Map();
    uc.plan.months.forEach((m) => m.tasks.forEach((t) => { if (t.docKey) monthOf.set(t.docKey, m.label); }));
    const docs = uc.docTemplates
      .filter((d) => !d.directions || d.directions.split(',').some((t) => dirTags.has(t.trim())))
      .map((d) => ({ ...d, cancelled: !!d.cancelled_from && uc.plan.endIso >= d.cancelled_from, taskKey: `doc-${d.key}`, done: uc.doneKeys.has(`doc-${d.key}`), plannedMonth: monthOf.get(d.key) || null }));
    const hints = String(uc.direction?.hints || '').split('|').filter(Boolean);
    return { docs, hints, requirements: requirementStatus(uc), direction: uc.direction, newRegime: uc.plan.newRegime };
  });

  route('GET', '/api/journals', 'user', async (req, body, ctx) => {
    const { category, access } = ctx.query;
    if (!rec.CATEGORIES.includes(category) || !['free', 'paid'].includes(access)) throw bad('category/access noto‘g‘ri');
    const r = await rec.ensureRecommendations(db, ctx.user.id, category, access);
    if (r.needProfile) return { needProfile: true };
    const items = rec.list(db, ctx.user.id, category, access);
    const log = db.prepare('SELECT summary, created_at FROM refresh_log WHERE user_id=? AND category=? AND access=? ORDER BY id DESC LIMIT 1').get(ctx.user.id, category, access);
    return { items, lastRefresh: log || null, ai: ai.enabled() };
  });

  route('POST', '/api/journals/refresh', 'user', async (req, body, ctx) => {
    const { category, access } = body;
    if (!rec.CATEGORIES.includes(category) || !['free', 'paid'].includes(access)) throw bad('category/access noto‘g‘ri');
    const res = await rec.refresh(db, ctx.user.id, category, access, { syncFeeds: () => feeds.syncConfiguredFeeds(db) });
    if (res.needProfile) throw bad('Avval profilni to‘ldiring');
    return res;
  });

  route('GET', '/api/journals/history', 'user', (req, body, ctx) => ({
    log: db.prepare('SELECT category, access, summary, created_at FROM refresh_log WHERE user_id=? ORDER BY id DESC LIMIT 30').all(ctx.user.id),
  }));

  // ---------- Admin ----------
  route('GET', '/api/admin/stats', 'admin', () => ({
    users: db.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").get().c,
    profiles: db.prepare('SELECT COUNT(*) c FROM profiles').get().c,
    journals: db.prepare('SELECT COUNT(*) c FROM journals').get().c,
    unverified: db.prepare('SELECT COUNT(*) c FROM journals WHERE verified=0').get().c,
    scopus: db.prepare("SELECT COUNT(*) c FROM journals WHERE scopus_status='active'").get().c,
    oak: db.prepare("SELECT COUNT(*) c FROM journals WHERE oak_status='active'").get().c,
    ai: ai.enabled(),
    feeds: { scopus: !!process.env.SCOPUS_FEED_URL, oak: !!process.env.OAK_FEED_URL },
    coverage: coverage(),
  }));

  function coverage() {
    // har bir yo'nalish uchun har bir toifa/kirish turida nechta nomzod jurnal bor (kamida 10 ta bo'lishi kerak)
    const dirs = db.prepare('SELECT * FROM directions ORDER BY code').all();
    return dirs.map((d) => {
      const row = { code: d.code, name: d.name };
      for (const c of rec.CATEGORIES) for (const a of ['free', 'paid']) row[`${c}_${a}`] = rec.candidates(db, c, a, d, '').length;
      return row;
    });
  }

  route('GET', '/api/admin/users', 'admin', () => ({
    users: db.prepare(`SELECT u.id, u.login, u.full_name, u.created_at, p.direction_code, p.topic, p.months, p.status
      FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.role='user' ORDER BY u.id DESC`).all()
      .map((u) => ({ ...u, progress: u.direction_code ? userContext(u.id).progress?.pct : null })),
  }));

  route('DELETE', '/api/admin/users/(\\d+)', 'admin', (req, body, ctx) => {
    db.prepare("DELETE FROM users WHERE id=? AND role='user'").run(Number(ctx.params[0]));
    return { ok: true };
  });

  route('GET', '/api/admin/changes', 'admin', () => ({
    changes: db.prepare('SELECT c.*, j.name FROM journal_changes c JOIN journals j ON j.id=c.journal_id ORDER BY c.id DESC LIMIT 200').all(),
  }));

  route('GET', '/api/admin/e/(\\w+)', 'admin', (req, body, ctx) => {
    const e = ENTITIES[ctx.params[0]]; if (!e) throw new HttpError(404, 'Topilmadi');
    return { cols: e.cols, pk: e.pk || 'id', rows: db.prepare(`SELECT ${e.pk || 'id'}${e.pk ? '' : ''}, ${e.cols.filter((c) => c !== e.pk).join(',')} FROM ${e.table} ORDER BY ${e.order}`).all() };
  });

  function entityData(e, body) {
    const data = {};
    for (const c of e.cols) if (c in body) data[c] = coerce(c, body[c]);
    return data;
  }

  route('POST', '/api/admin/e/(\\w+)', 'admin', (req, body, ctx) => {
    const e = ENTITIES[ctx.params[0]]; if (!e) throw new HttpError(404, 'Topilmadi');
    const data = entityData(e, body);
    if (!(data.name || data.title || data.code || data.text)) throw bad('Nom/sarlavha kiritilmagan');
    const keys = Object.keys(data);
    const r = db.prepare(`INSERT INTO ${e.table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map((k) => data[k]));
    if (e.table === 'journals') rec.logChange(db, Number(r.lastInsertRowid), 'created', '', data.name, 'admin');
    return { ok: true, id: Number(r.lastInsertRowid) };
  });

  route('PUT', '/api/admin/e/(\\w+)/([^/]+)', 'admin', (req, body, ctx) => {
    const e = ENTITIES[ctx.params[0]]; if (!e) throw new HttpError(404, 'Topilmadi');
    const pk = e.pk || 'id';
    const id = e.pk ? decodeURIComponent(ctx.params[1]) : Number(ctx.params[1]);
    const data = entityData(e, body);
    delete data[pk];
    const before = db.prepare(`SELECT * FROM ${e.table} WHERE ${pk}=?`).get(id);
    if (!before) throw new HttpError(404, 'Topilmadi');
    const keys = Object.keys(data);
    if (!keys.length) return { ok: true };
    const extra = e.table === 'journals' ? ", updated_at=datetime('now')" : '';
    db.prepare(`UPDATE ${e.table} SET ${keys.map((k) => `${k}=?`).join(',')}${extra} WHERE ${pk}=?`).run(...keys.map((k) => data[k]), id);
    if (e.track) for (const k of e.track) if (k in data && String(before[k] ?? '') !== String(data[k] ?? '')) rec.logChange(db, id, k, before[k], data[k], 'admin');
    return { ok: true };
  });

  route('DELETE', '/api/admin/e/(\\w+)/([^/]+)', 'admin', (req, body, ctx) => {
    const e = ENTITIES[ctx.params[0]]; if (!e) throw new HttpError(404, 'Topilmadi');
    const pk = e.pk || 'id';
    db.prepare(`DELETE FROM ${e.table} WHERE ${pk}=?`).run(e.pk ? decodeURIComponent(ctx.params[1]) : Number(ctx.params[1]));
    return { ok: true };
  });

  // Fid yuklash: CSV/JSON matn
  route('POST', '/api/admin/import', 'admin', (req, body) => {
    const source = body.source === 'oak' ? 'oak' : 'scopus';
    let items;
    try { items = feeds.parseFeed(String(body.content || '')); } catch (e) { throw bad(`Faylni o'qib bo'lmadi: ${e.message}`); }
    if (!items.length) throw bad("Faylda yozuv topilmadi");
    const stats = feeds.applyFeed(db, items, source, { mode: body.full ? 'full' : 'delta', addNew: !!body.addNew });
    return { ok: true, total: items.length, stats, text: feeds.describe(stats) };
  });

  route('POST', '/api/admin/sync', 'admin', async () => {
    const msg = await feeds.syncConfiguredFeeds(db, { force: true });
    return { ok: true, message: msg || 'Sozlangan fid manbalari yo‘q (SCOPUS_FEED_URL / OAK_FEED_URL).' };
  });

  route('POST', '/api/admin/ai-import', 'admin', async (req, body) => {
    if (!ai.enabled()) throw bad('AI uchun ANTHROPIC_API_KEY o‘rnatilmagan');
    const arr = await ai.extractJournals(String(body.content || ''), body.source === 'oak' ? "OAK tomonidan e'tirof etilgan jurnallar ro'yxati" : 'Scopus jurnallari');
    if (!Array.isArray(arr) || !arr.length) throw bad('AI hech narsa ajrata olmadi');
    const items = arr.map(feeds.normalizeItem);
    const stats = feeds.applyFeed(db, items, body.source === 'oak' ? 'oak' : 'scopus', { mode: 'delta', addNew: true });
    return { ok: true, total: items.length, stats, text: feeds.describe(stats) };
  });

  // ---------- HTTP qatlami ----------
  function parseCookies(h) {
    return Object.fromEntries(String(h || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
  }

  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 6e6) throw new HttpError(413, 'Hajm juda katta'); chunks.push(c); }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw bad('JSON noto‘g‘ri'); }
  }

  function serveStatic(req, res, pathname) {
    let rel = pathname === '/' ? '/index.html' : pathname;
    const file = path.normalize(path.join(PUBLIC, rel));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Topilmadi');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('content-security-policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'");
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);

    const json = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
    try {
      const cookies = parseCookies(req.headers.cookie);
      const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
      const ctx = {
        token: cookies.sid, user: auth.userFromToken(db, cookies.sid), query: Object.fromEntries(url.searchParams), params: [],
        ip: req.socket.remoteAddress,
        setCookie: ({ token, maxAge }) => res.setHeader('set-cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`),
        clearCookie: () => res.setHeader('set-cookie', `sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`),
      };
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = url.pathname.match(r.re);
        if (!m) continue;
        ctx.params = m.slice(1);
        if (r.access !== 'public' && !ctx.user) throw new HttpError(401, 'Tizimga kiring');
        if (r.access === 'admin' && ctx.user.role !== 'admin') throw new HttpError(403, 'Ruxsat yo‘q');
        if (r.access === 'user' && ctx.user.role !== 'user') throw new HttpError(403, 'Bu bo‘lim tadqiqotchilar uchun');
        let body = {};
        if (req.method !== 'GET') {
          if (!String(req.headers['content-type'] || '').includes('application/json') && Number(req.headers['content-length'] || 0) > 0) throw new HttpError(415, 'application/json kerak');
          body = await readBody(req);
        }
        return json(200, await r.handler(req, body, ctx));
      }
      throw new HttpError(404, 'Topilmadi');
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Ichki xatolik' });
    }
  };
  return http.createServer(handler);
}

function start() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  const db = open(path.join(dataDir, 'ilmiy.db'));
  seedAll(db);
  auth.ensureAdmin(db);
  const port = Number(process.env.PORT || 3000);
  createApp(db).listen(port, () => console.log(`Ilmiy yuksalish: http://localhost:${port}  (AI: ${ai.enabled() ? 'yoqilgan' : "o'chiq — ANTHROPIC_API_KEY o'rnatilmagan"})`));
}

if (require.main === module) start();
module.exports = { createApp };
