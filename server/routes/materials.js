// Teacher uploads (books, PDFs, audio ...) for students.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { q } from '../lib/db.js';
import { cfg } from '../lib/env.js';
import { bad, HttpError, readRaw } from '../lib/http.js';

const MAX = 25 * 1024 * 1024;
const TYPES = { '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.txt': 'text/plain; charset=utf-8', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const dir = () => { const d = path.join(cfg.dataDir, 'uploads'); fs.mkdirSync(d, { recursive: true }); return d; };

export function listMaterialsFor(teacherId, studentId = null) {
  const rows = studentId
    ? q.all('SELECT id,title,description,filename,mime,size,student_id,created_at FROM materials WHERE owner_id=? AND (student_id IS NULL OR student_id=?) ORDER BY id DESC', teacherId, studentId)
    : q.all('SELECT id,title,description,filename,mime,size,student_id,created_at FROM materials WHERE owner_id=? ORDER BY id DESC', teacherId);
  return rows.map((m) => ({ ...m, forAll: m.student_id == null }));
}

export function registerMaterials(r) {
  r.post('/api/teacher/materials', async ({ req, user, query }) => {
    const filename = path.basename(decodeURIComponent(String(req.headers['x-filename'] || ''))).replace(/[^\w.\- ()]/g, '_').slice(0, 120);
    const ext = path.extname(filename).toLowerCase();
    if (!filename || !TYPES[ext]) throw bad(`Fayl turi qo'llab-quvvatlanmaydi. Ruxsat: ${Object.keys(TYPES).join(' ')}`);
    const title = String(query.title || filename).trim().slice(0, 120);
    let studentId = null;
    if (query.studentId) {
      const s = q.get("SELECT id FROM users WHERE id=? AND role='student' AND teacher_id=?", Number(query.studentId), user.id);
      if (!s) throw new HttpError(404, "O'quvchi topilmadi");
      studentId = s.id;
    }
    const buf = await readRaw(req, MAX);
    if (!buf.length) throw bad("Fayl bo'sh");
    const stored = crypto.randomBytes(16).toString('hex') + ext;
    fs.writeFileSync(path.join(dir(), stored), buf);
    const id = q.run('INSERT INTO materials(owner_id,student_id,title,description,filename,stored,mime,size) VALUES(?,?,?,?,?,?,?,?)',
      user.id, studentId, title, String(query.description || '').slice(0, 500), filename, stored, TYPES[ext], buf.length).lastInsertRowid;
    return { id };
  }, { role: 'teacher', raw: true });

  r.get('/api/teacher/materials', ({ user }) => listMaterialsFor(user.id), { role: 'teacher' });
  r.delete('/api/teacher/materials/:id', ({ user, params }) => {
    const m = q.get('SELECT * FROM materials WHERE id=? AND owner_id=?', Number(params.id), user.id);
    if (!m) throw new HttpError(404, 'Topilmadi');
    q.run('DELETE FROM materials WHERE id=?', m.id);
    fs.rm(path.join(dir(), m.stored), { force: true }, () => {});
    return { ok: true };
  }, { role: 'teacher' });

  r.get('/api/materials', ({ user }) => {
    if (!user.teacher_id) return [];
    return listMaterialsFor(user.teacher_id, user.id).map(({ student_id, ...m }) => m);
  }, { role: 'student' });

  r.get('/api/materials/:id/download', ({ user, params, res }) => {
    const m = q.get('SELECT * FROM materials WHERE id=?', Number(params.id));
    const allowed = m && (user.role === 'teacher' ? m.owner_id === user.id : user.teacher_id === m.owner_id && (m.student_id == null || m.student_id === user.id));
    if (!allowed) throw new HttpError(404, 'Topilmadi');
    const file = path.join(dir(), m.stored);
    if (!fs.existsSync(file)) throw new HttpError(404, 'Fayl topilmadi');
    res.writeHead(200, { 'content-type': m.mime, 'content-length': m.size, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(m.filename)}`, 'x-content-type-options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}
