-- Used when no R2 bucket is bound (free plan without a card): file bytes stored as base64 chunks in D1.
CREATE TABLE IF NOT EXISTS material_chunks (
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (material_id, idx)
);
