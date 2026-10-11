// Cloudflare Worker entry: /api/* is handled here, everything else is served from Workers Assets (/public).
import { setEnv } from './lib/env.js';
import { createRouter, HttpError, readJson, parseCookies } from './lib/http.js';
import { userFromToken } from './lib/auth.js';
import { clientDate } from './lib/dates.js';
import { flushTts, loadDbKeys } from './lib/gemini.js';
import { registerAuth } from './routes/auth.js';
import { registerDiagnostic } from './routes/diagnostic.js';
import { registerPlan } from './routes/plan.js';
import { registerTasks } from './routes/tasks.js';
import { registerTrainers } from './routes/trainers.js';
import { registerSpeaking } from './routes/speaking.js';
import { registerBuddy } from './routes/buddy.js';
import { registerTeacher } from './routes/teacher.js';
import { registerMaterials } from './routes/materials.js';
import { registerMock } from './routes/mock.js';

export const router = createRouter();
[registerAuth, registerDiagnostic, registerPlan, registerTasks, registerTrainers, registerSpeaking, registerBuddy, registerTeacher, registerMaterials, registerMock].forEach((r) => r(router));

const SECURITY = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' };

function toResponse(out, resHeaders) {
  const h = new Headers(resHeaders);
  for (const [k, v] of Object.entries(SECURITY)) h.set(k, v);
  if (out instanceof Response) { for (const [k, v] of h) if (k !== 'content-type') out.headers.append(k, v); return out; }
  h.set('content-type', 'application/json; charset=utf-8'); h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(out ?? { ok: true }), { status: 200, headers: h });
}
const errorResponse = (status, body) => {
  const h = new Headers(SECURITY); h.set('content-type', 'application/json; charset=utf-8'); h.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: h });
};

async function handle(request, env, execCtx) {
  const url = new URL(request.url);
  const m = router.match(request.method, url.pathname);
  if (!m) throw new HttpError(request.method === 'GET' ? 404 : 405, 'Topilmadi');
  const { route, params } = m;
  const unsafe = request.method !== 'GET' && request.method !== 'HEAD';
  if (unsafe) { // CSRF defence in depth (cookies are SameSite=Lax as well)
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== url.host) throw new HttpError(403, 'Origin ruxsat etilmagan');
    const ct = request.headers.get('content-type') || '';
    const len = request.headers.get('content-length');
    if (!route.opts.raw && !ct.includes('application/json') && !(len === '0' || len === null)) throw new HttpError(415, 'JSON kerak');
    if (route.opts.raw && !request.headers.get('x-requested-with')) throw new HttpError(403, "Noto'g'ri so'rov");
  }
  await loadDbKeys();
  const user = await userFromToken(parseCookies(request).sid);
  if (route.opts.auth !== false && !user) throw new HttpError(401, 'Tizimga kiring');
  if (route.opts.role && user?.role !== route.opts.role) throw new HttpError(403, "Bu amal uchun ruxsat yo'q");
  const resHeaders = new Headers();
  const ctx = {
    request, url, params, user,
    query: Object.fromEntries(url.searchParams),
    date: clientDate(request.headers.get('x-local-date')),
    body: unsafe && !route.opts.raw ? await readJson(request, route.opts.limit) : {},
    waitUntil: (p) => { try { execCtx?.waitUntil?.(p); } catch { /* tests */ } },
    setCookie: (v) => resHeaders.append('set-cookie', url.protocol === 'https:' ? v : v.replace('; Secure', '')),
  };
  const out = await route.handler(ctx);
  await flushTts();
  return toResponse(out, resHeaders);
}

export default {
  async fetch(request, env, execCtx) {
    setEnv(env);
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    try {
      return await handle(request, env, execCtx);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e && e.stack ? e.stack : e);
      return errorResponse(status, { error: status === 500 ? 'Server xatosi' : e.message, ...(e.extra || {}) });
    }
  },
};
