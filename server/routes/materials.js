// Teacher uploads (books, PDFs, audio ...) for students, stored in Cloudflare R2.
import { q } from '../lib/db.js';
import { getEnv } from '../lib/env.js';
import { bad, HttpError, readRaw } from '../lib/http.js';

const MAX = 25 * 1024 * 1024;
const TYPES = { '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.txt': 'text/plain; charset=utf-8', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const files = () => { const f = getEnv().FILES; if (!f) throw new HttpError(500, 'R2 bucket "FILES" ulanmagan'); return f; };
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const baseName = (p) => p.split(/[\\/]/).pop();

export async function listMaterialsFor(teacherId, studentId = null) {
  const rows = studentId
    ? await q.all('SELECT id,title,description,filename,mime,size,student_id,created_at FROM materials WHERE owner_id=? AND (student_id IS NULL OR student_id=?) ORDER BY id DESC', teacherId, studentId)
    : await q.all('SELECT id,title,description,filename,mime,size,student_id,created_at FROM materials WHERE owner_id=? ORDER BY id DESC', teacherId);
  return rows.map((m) => ({ ...m, forAll: m.student_id == null }));
}

export function registerMaterials(r) {
  r.post('/api/teacher/materials', async ({ request, user, query }) => {
    let raw = '';
    try { raw = decodeURIComponent(String(request.headers.get('x-filename') || '')); } catch { raw = ''; }
    const filename = baseName(raw).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
    const ext = filename.includes('.') ? '.' + filename.split('.').pop().toLowerCase() : '';
    if (!filename || !TYPES[ext]) throw bad(`Fayl turi qo'llab-quvvatlanmaydi. Ruxsat: ${Object.keys(TYPES).join(' ')}`);
    const title = String(query.title || filename).trim().slice(0, 120);
    let studentId = null;
    if (query.studentId) {
      const s = await q.get("SELECT id FROM users WHERE id=? AND role='student' AND teacher_id=?", Number(query.studentId), user.id);
      if (!s) throw new HttpError(404, "O'quvchi topilmadi");
      studentId = s.id;
    }
    const buf = await readRaw(request, MAX);
    if (!buf.length) throw bad("Fayl bo'sh");
    const stored = `materials/${randHex(16)}${ext}`;
    await files().put(stored, buf, { httpMetadata: { contentType: TYPES[ext] } });
    const id = (await q.run('INSERT INTO materials(owner_id,student_id,title,description,filename,stored,mime,size) VALUES(?,?,?,?,?,?,?,?)',
      user.id, studentId, title, String(query.description || '').slice(0, 500), filename, stored, TYPES[ext], buf.length)).lastInsertRowid;
    return { id };
  }, { role: 'teacher', raw: true });

  r.get('/api/teacher/materials', async ({ user }) => listMaterialsFor(user.id), { role: 'teacher' });
  r.delete('/api/teacher/materials/:id', async ({ user, params }) => {
    const m = await q.get('SELECT * FROM materials WHERE id=? AND owner_id=?', Number(params.id), user.id);
    if (!m) throw new HttpError(404, 'Topilmadi');
    await q.run('DELETE FROM materials WHERE id=?', m.id);
    await files().delete(m.stored);
    return { ok: true };
  }, { role: 'teacher' });

  r.get('/api/materials', async ({ user }) => {
    if (!user.teacher_id) return [];
    return (await listMaterialsFor(user.teacher_id, user.id)).map(({ student_id, ...m }) => m);
  }, { role: 'student' });

  r.get('/api/materials/:id/download', async ({ user, params }) => {
    const m = await q.get('SELECT * FROM materials WHERE id=?', Number(params.id));
    const allowed = m && (user.role === 'teacher' ? m.owner_id === user.id : user.teacher_id === m.owner_id && (m.student_id == null || m.student_id === user.id));
    if (!allowed) throw new HttpError(404, 'Topilmadi');
    const obj = await files().get(m.stored);
    if (!obj) throw new HttpError(404, 'Fayl topilmadi');
    return new Response(obj.body, { headers: { 'content-type': m.mime, 'content-length': String(m.size), 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(m.filename)}`, 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' } });
  });
}
