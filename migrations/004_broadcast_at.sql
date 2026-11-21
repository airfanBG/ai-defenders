-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/004_broadcast_at.sql
-- Кога екипът е получил писмото до всички (за да не се праща два пъти).
ALTER TABLE teams ADD COLUMN broadcast_at TEXT;
