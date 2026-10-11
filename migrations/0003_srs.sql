-- Spaced repetition state per learned word
ALTER TABLE learned_words ADD COLUMN box INTEGER NOT NULL DEFAULT 0;
ALTER TABLE learned_words ADD COLUMN due TEXT;
CREATE INDEX IF NOT EXISTS learned_words_due ON learned_words(user_id, due);
