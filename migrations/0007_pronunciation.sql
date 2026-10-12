-- Results of the pronunciation trainer (one row per checked recording)
CREATE TABLE IF NOT EXISTS pron_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sentence_id INTEGER NOT NULL,
  focus TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS pron_user ON pron_results(user_id, id);
