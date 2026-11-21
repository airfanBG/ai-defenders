-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/005_feedback.sql
-- Отговорите от анкетата след хакатона. Анонимни: пазим само отговорите и хеш на IP за защита от спам.
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  answers     TEXT NOT NULL,           -- JSON с отговорите
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_ip ON feedback(ip_hash, created_at);
