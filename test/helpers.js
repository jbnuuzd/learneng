import http from 'node:http';
import fs from 'node:fs';
import { createD1, createR2 } from './shims.js';

// Boots the real Worker (server/worker.js) behind a tiny Node http adapter, with in-memory D1 + R2 doubles.
export async function boot(vars = {}) {
  const schema = fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
  const env = { DB: createD1(schema), FILES: createR2(), ...vars };
  const { setEnv } = await import('../server/lib/env.js');
  setEnv(env);
  const { default: worker } = await import('../server/worker.js');
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(',') : v);
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const response = await worker.fetch(request, env);
    const out = Buffer.from(await response.arrayBuffer());
    const rh = {};
    response.headers.forEach((v, k) => { if (k !== 'set-cookie') rh[k] = v; });
    const sc = response.headers.getSetCookie?.() || [];
    if (sc.length) rh['set-cookie'] = sc;
    res.writeHead(response.status, rh);
    res.end(out);
  });
  await new Promise((r) => server.listen(0, r));
  return { base: `http://127.0.0.1:${server.address().port}`, env, close: () => new Promise((r) => server.close(r)) };
}

export class Client {
  constructor(base, date) { this.base = base; this.cookie = ''; this.date = date; }
  async req(method, url, body, headers = {}) {
    const res = await fetch(this.base + url, {
      method, headers: { 'content-type': 'application/json', cookie: this.cookie, 'x-local-date': this.date, ...headers },
      body: body === undefined ? undefined : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get(u) { return this.req('GET', u); }
  post(u, b = {}) { return this.req('POST', u, b); }
  put(u, b = {}) { return this.req('PUT', u, b); }
  del(u) { return this.req('DELETE', u); }
}
export const today = () => new Date().toISOString().slice(0, 10);
