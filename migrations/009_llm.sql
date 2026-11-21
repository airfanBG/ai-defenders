-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/009_llm.sql
-- Ключове на екипите за общия модел (/api/llm) и запис на заявките.
CREATE TABLE IF NOT EXISTS llm_keys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,                 -- за кого е ключът (екип)
  key_hash    TEXT NOT NULL UNIQUE,          -- SHA-256 на ключа; самият ключ не се пази
  prefix      TEXT NOT NULL,                 -- първите знаци, за да се разпознава в списъка
  per_min     INTEGER NOT NULL DEFAULT 20,
  per_day     INTEGER NOT NULL DEFAULT 2000,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS llm_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key_id      INTEGER,                       -- NULL = проба от админа
  model       TEXT,
  ok          INTEGER NOT NULL DEFAULT 1,
  ms          INTEGER,
  prompt      TEXT,                          -- последното съобщение, съкратено
  reply       TEXT,                          -- отговорът, съкратен
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_llm_log_key ON llm_log(key_id, created_at);
