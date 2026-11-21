-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/003_partners.sql
CREATE TABLE IF NOT EXISTS partners (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  url         TEXT,
  bg          TEXT NOT NULL DEFAULT '#ffffff',  -- фон на карето (за бели лога — тъмен)
  sort        INTEGER NOT NULL DEFAULT 0,
  logo        TEXT NOT NULL,                    -- base64
  mime        TEXT NOT NULL,                    -- image/png | image/jpeg | image/webp
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
