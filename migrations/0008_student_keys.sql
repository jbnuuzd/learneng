-- A student's own Gemini API key(s): when present, that student's AI requests use them (and their limit) instead of the shared pool
CREATE TABLE IF NOT EXISTS student_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, api_key)
);
