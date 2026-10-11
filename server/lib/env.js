// Cloudflare Workers environment: bindings (DB, FILES, ASSETS) and vars/secrets arrive per request.
// The worker entry calls setEnv(env) first; everything else reads through cfg / getEnv().
let current = {};
export const setEnv = (env) => { current = env || {}; };
export const getEnv = () => current;

export const cfg = {
  get apiKey() { return current.GEMINI_API_KEY || ''; },
  get textModel() { return current.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'; },
  get ttsModel() { return current.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'; },
  get baseUrl() { return current.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'; },
  get teacherCode() { return current.TEACHER_SIGNUP_CODE || ''; },
};
