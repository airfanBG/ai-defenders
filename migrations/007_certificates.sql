-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/007_certificates.sql
-- Имената за сертификатите, както ги въвеждат участниците (по QR кода в деня на хакатона).
CREATE TABLE IF NOT EXISTS certificates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,           -- трите имена, както да излязат на сертификата
  school      TEXT,                    -- училище / университет
  kind        TEXT,                    -- "ученик" или "студент"
  grade       TEXT,                    -- "12 клас", "2 курс", "магистър"…
  team_id     INTEGER,
  team_name   TEXT,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_certificates_ip ON certificates(ip_hash, created_at);
