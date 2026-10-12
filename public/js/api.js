import { state } from './state.js';

export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export class ApiError extends Error { constructor(status, message, data) { super(message); this.status = status; this.data = data; } }

async function request(method, url, body, opts = {}) {
  const headers = { 'x-local-date': localDate(), ...(opts.headers || {}) };
  let payload;
  if (body instanceof Blob || body instanceof ArrayBuffer) payload = body;
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/') && url !== '/api/me') { window.dispatchEvent(new Event('auth-lost')); }
    let msg = data?.error || `Xato (${res.status})`;
    // AI quota exhausted: tell a student how to keep learning on their own key
    if (res.status === 502 && /429|RESOURCE_EXHAUSTED|quota|kvota|limit/i.test(msg) && !/Shaxsiy/.test(msg) && state.me?.user?.role === 'student')
      msg += " — Umumiy AI limiti tugagan. O'z bepul kalitingizni qo'shing: Profil → «Shaxsiy Gemini API kalitim».";
    throw new ApiError(res.status, msg, data);
  }
  return data;
}
export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b = {}) => request('PUT', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, file) => request('POST', u, file, { headers: { 'x-filename': encodeURIComponent(file.name), 'x-requested-with': 'fetch', 'content-type': 'application/octet-stream' } }),
};
