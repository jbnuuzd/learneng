// Cloudflare Workers environment: bindings (DB, FILES, ASSETS) and vars/secrets arrive per request.
// The worker entry calls setEnv(env) first; everything else reads through cfg / getEnv().
let current = {};
export const setEnv = (env) => { current = env || {}; };
export const getEnv = () => current;

export const cfg = {
  get apiKey() { return this.apiKeys[0] || ''; },
  // Several keys may be given: GEMINI_API_KEY (also comma/space/newline separated), GEMINI_API_KEY_2 … GEMINI_API_KEY_9, GEMINI_API_KEYS.
  get apiKeys() {
    const raw = [current.GEMINI_API_KEY, current.GEMINI_API_KEYS, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => current['GEMINI_API_KEY_' + n])].filter(Boolean).join(',');
    return [...new Set(raw.split(/[\s,;]+/).filter(Boolean))];
  },
  get textModel() { return current.GEMINI_TEXT_MODEL || 'gemini-3.8-flash'; },
  get ttsModel() { return current.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'; },
  get baseUrl() { return current.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'; },
  get teacherCode() { return current.TEACHER_SIGNUP_CODE || ''; },
};
