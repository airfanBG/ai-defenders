-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/002_notified_at.sql
ALTER TABLE teams ADD COLUMN notified_at TEXT;
