import http from 'node:http';
import path from 'node:path';
import { cfg, ROOT } from './lib/env.js';
import { createRouter, HttpError, readJson, sendJson, serveStatic, parseCookies } from './lib/http.js';
import { userFromToken } from './lib/auth.js';
import { clientDate } from './lib/dates.js';
import { registerAuth } from './routes/auth.js';
import { registerDiagnostic } from './routes/diagnostic.js';
import { registerPlan } from './routes/plan.js';
import { registerTasks } from './routes/tasks.js';
import { registerTrainers } from './routes/trainers.js';
import { registerSpeaking } from './routes/speaking.js';
import { registerTeacher } from './routes/teacher.js';
import { registerMaterials } from './routes/materials.js';

const PUBLIC = path.join(ROOT, 'public');
export const router = createRouter();
[registerAuth, registerDiagnostic, registerPlan, registerTasks, registerTrainers, registerSpeaking, registerTeacher, registerMaterials].forEach((r) => r(router));

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";

export function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'same-origin');
    res.setHeader('content-security-policy', CSP);
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
        return serveStatic(PUBLIC, url.pathname, res);
      }
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'Topilmadi');
      const { route, params } = m;
      const unsafe = req.method !== 'GET' && req.method !== 'HEAD';
      if (unsafe) { // CSRF defence in depth (cookies are SameSite=Lax as well)
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Origin ruxsat etilmagan');
        const ct = req.headers['content-type'] || '';
        if (!route.opts.raw && !ct.includes('application/json') && !(req.headers['content-length'] === '0' || req.headers['content-length'] === undefined)) throw new HttpError(415, 'JSON kerak');
        if (route.opts.raw && !req.headers['x-requested-with']) throw new HttpError(403, "Noto'g'ri so'rov");
      }
      const user = userFromToken(parseCookies(req).sid);
      if (route.opts.auth !== false && !user) throw new HttpError(401, 'Tizimga kiring');
      if (route.opts.role && user?.role !== route.opts.role) throw new HttpError(403, "Bu amal uchun ruxsat yo'q");
      const ctx = {
        req, res, url, params, user,
        query: Object.fromEntries(url.searchParams),
        date: clientDate(req.headers['x-local-date']),
        body: unsafe && !route.opts.raw ? await readJson(req, route.opts.limit) : {},
      };
      const out = await route.handler(ctx);
      if (!res.headersSent && !res.writableEnded) sendJson(res, 200, out ?? { ok: true });
    } catch (e) {
      if (res.headersSent) { res.end(); return; }
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      sendJson(res, status, { error: status === 500 ? 'Server xatosi' : e.message, ...(e.extra || {}) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(cfg.port, () => {
    console.log(`LearnEng http://localhost:${cfg.port}  (AI: ${cfg.apiKey ? 'Gemini ulangan' : "o'chiq — .env da GEMINI_API_KEY ni kiriting"})`);
  });
}
