-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/006_submissions.sql
-- Предадените решения: по един ред на екип (при повторно предаване се презаписва).
CREATE TABLE IF NOT EXISTS submissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  team_key    TEXT NOT NULL UNIQUE,    -- "id:5" за регистриран екип, "name:<име>" за екип извън системата
  team_id     INTEGER,
  team_name   TEXT NOT NULL,
  email       TEXT NOT NULL,           -- кой е предал
  repo        TEXT NOT NULL,
  demo        TEXT,
  description TEXT NOT NULL,
  today       TEXT,                    -- какво е направено днес (за проекти, започнати по-рано)
  late        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
