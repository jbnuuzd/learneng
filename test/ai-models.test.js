// Retired model names and the TTS "tried to generate text" quirk (both seen on the live site).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { boot, Client, today } from './helpers.js';
import { pickModel } from '../server/lib/gemini.js';

const seen = []; let ttsCalls = 0, fake, srv, teacher;
const audio = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: Buffer.alloc(2400).toString('base64') } }] } }] };
before(async () => {
  fake = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const send = (status, o) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.method === 'GET' && req.url.startsWith('/v1beta/models')) return send(200, { models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.8-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.8-flash-image', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.8-pro', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding-9', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] }] });
      const model = /models\/([^:]+):/.exec(req.url)?.[1]; const body = JSON.parse(b);
      seen.push({ model, body });
      if (model === 'gemini-2.5-flash') return send(404, { error: { code: 404, status: 'NOT_FOUND', message: 'This model models/gemini-2.5-flash is no longer available to new users.' } });
      if (body.generationConfig?.responseModalities) {
        if (++ttsCalls === 1) return send(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Model tried to generate text, but it should only be used for TTS.' } });
        return send(200, audio);
      }
      const text = body.generationConfig?.responseMimeType === 'application/json' ? '{"ok":true}' : 'OK';
      return send(200, { candidates: [{ content: { parts: [{ text: model === 'gemini-3.8-flash' ? text : 'WRONG MODEL' }] } }] });
    });
  });
  await new Promise((r) => fake.listen(0, r));
  srv = await boot({ GEMINI_API_KEY: 'k', GEMINI_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1beta`, GEMINI_TEXT_MODEL: 'gemini-2.5-flash', GEMINI_TTS_MODEL: 'gemini-2.5-flash-preview-tts' });
  teacher = new Client(srv.base, today());
  await teacher.post('/api/auth/register', { name: 'Teach', email: 'm@x.com', password: 'password1', role: 'teacher' });
});
after(async () => { await srv.close(); fake.close(); });

test('pickModel chooses the newest plain flash model and the newest TTS model', () => {
  const names = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-flash-image', 'gemini-3.8-pro', 'gemini-2.5-flash-preview-tts', 'gemini-3.0-flash-live'];
  assert.equal(pickModel('text', names), 'gemini-3.8-flash');
  assert.equal(pickModel('tts', names), 'gemini-2.5-flash-preview-tts');
  assert.equal(pickModel('text', ['gemini-2.5-pro']), null);
});

test('a retired model (404) is replaced automatically and remembered', async () => {
  const r = await teacher.post('/api/ai/test');
  assert.equal(r.status, 200);
  assert.equal(r.data.tests.text.ok, true, JSON.stringify(r.data.tests.text));
  assert.equal(r.data.tests.audio.ok, true);
  assert.equal(r.data.textModel, 'gemini-3.8-flash'); assert.equal(r.data.autoSwitched.text, 'gemini-3.8-flash');
  assert.equal(r.data.configured.text, 'gemini-2.5-flash');
  const attempts = seen.filter((s) => s.model === 'gemini-2.5-flash').length;
  await teacher.post('/api/ai/test');
  assert.equal(seen.filter((s) => s.model === 'gemini-2.5-flash').length, attempts, 'the retired model is not tried again');
});

test('TTS: short text gets a "Say clearly:" instruction and the text-instead-of-audio error is retried', async () => {
  const r = await teacher.post('/api/ai/test');
  assert.equal(r.data.tests.tts.ok, true, JSON.stringify(r.data.tests.tts));
  assert.ok(ttsCalls >= 2, 'retried after the first 400');
  const ttsReq = seen.filter((s) => s.body.generationConfig?.responseModalities).at(-1);
  assert.match(ttsReq.body.contents[0].parts[0].text, /^Say clearly: Hello\./);
  assert.equal(r.data.allOk, true);
});
