-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/011_access_code.sql
-- Кодът за достъп на екипа: служител с този код трябва да получи тайната, всеки друг не.
ALTER TABLE arena_targets ADD COLUMN access_code TEXT;
