import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Minimal .env loader (no dependencies). Real environment variables win.
const file = path.join(ROOT, '.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

export const cfg = {
  get port() { return Number(process.env.PORT || 3000); },
  get apiKey() { return process.env.GEMINI_API_KEY || ''; },
  get textModel() { return process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'; },
  get ttsModel() { return process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'; },
  get baseUrl() { return process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'; },
  get teacherCode() { return process.env.TEACHER_SIGNUP_CODE || ''; },
  get dataDir() { return process.env.DATA_DIR || path.join(ROOT, 'data'); },
};
