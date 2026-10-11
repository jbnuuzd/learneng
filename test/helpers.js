import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Boots the real server on a random port with a throw-away database.
export async function boot(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learneng-'));
  process.env.DATA_DIR = dir;
  process.env.DB_FILE = path.join(dir, 'test.db');
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const { createServer } = await import('../server/index.js');
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)), dir };
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
