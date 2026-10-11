CREATE TABLE IF NOT EXISTS mock_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                       -- mini | full
  level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open | done
  content_json TEXT NOT NULL DEFAULT '{}',
  sections_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS mock_user ON mock_tests(user_id, id);
