-- Gemini API keys added by teachers in the UI (in addition to the GEMINI_API_KEY secrets)
CREATE TABLE IF NOT EXISTS ai_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  added_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
