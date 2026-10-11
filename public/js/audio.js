let current = null;
const cache = new Map();

export function stopAudio() {
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function speak(text, rate = 1) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate;
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('en'));
    if (v) u.voice = v;
    u.onend = () => resolve(true); u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}
// Plays server TTS (Gemini). Falls back to the browser voice when the server has no AI key.
export async function playAudio(id, rate = 1) {
  stopAudio();
  let entry = cache.get(id);
  if (!entry) {
    const res = await fetch('/api/tts/' + id, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Audio yuklanmadi');
    const ct = res.headers.get('content-type') || '';
    entry = ct.includes('json') ? { text: (await res.json()).text } : { url: URL.createObjectURL(await res.blob()) };
    cache.set(id, entry);
  }
  if (entry.text) return speak(entry.text, rate);
  const a = new Audio(entry.url); a.playbackRate = rate; current = a;
  return new Promise((resolve) => { a.onended = () => resolve(true); a.onerror = () => resolve(false); a.play().catch(() => resolve(false)); });
}

// ---- recording -> 16 kHz mono WAV (base64) ---------------------------------------
function encodeWav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return buf;
}
const b64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };

export class Recorder {
  constructor() { this.chunks = []; this.rec = null; this.stream = null; this.t0 = 0; }
  static supported() { return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); }
  async start() {
    stopAudio();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.chunks = []; this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(); this.t0 = Date.now();
  }
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.rec) return reject(new Error('Yozuv boshlanmagan'));
      this.rec.onstop = async () => {
        try {
          this.stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(this.chunks, { type: this.rec.mimeType });
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
          const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
          const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
          const rendered = await off.startRendering();
          const wav = encodeWav(rendered.getChannelData(0), 16000);
          ctx.close();
          resolve({ base64: b64(wav), url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), seconds: Math.round(decoded.duration) });
        } catch (e) { reject(e); }
      };
      this.rec.stop();
    });
  }
}
