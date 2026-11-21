-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/008_feedback_done.sql
-- Кой е попълнил анкетата през личния си линк от напомнянето. Отделно от отговорите,
-- за да останат те анонимни: тук е само „този човек е попълнил“, без връзка към отговора.
CREATE TABLE IF NOT EXISTS feedback_done (
  ref         TEXT PRIMARY KEY,         -- личният ключ от линка (хеш от имейла)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
