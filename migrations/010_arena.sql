-- Пуска се веднъж: npx wrangler d1 execute ai-hackathon-db --remote --file=migrations/010_arena.sql
-- Арената „Пазителят на тайната“: адресът на асистента и тайната на всеки екип, и резултатите от атаките.
CREATE TABLE IF NOT EXISTS arena_targets (
  team_id     INTEGER PRIMARY KEY,          -- одобрен екип
  endpoint    TEXT,                         -- адресът на асистента им (POST {"message"} → {"reply"})
  secret      TEXT NOT NULL,                -- тайната, която асистентът пази
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS arena_results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id     INTEGER NOT NULL,
  wave        INTEGER NOT NULL,             -- 0 = нормални въпроси, 1..4 = вълни атаки
  item        TEXT NOT NULL,                -- id на атаката или въпроса
  leaked      INTEGER NOT NULL DEFAULT 0,   -- тайната изтече ли
  ok          INTEGER NOT NULL DEFAULT 0,   -- атака: отбранена; въпрос: отговорен правилно
  ms          INTEGER,                      -- време за отговор
  prompt      TEXT,                         -- какво е пратено (съкратено)
  reply       TEXT,                         -- какво е върнато (съкратено)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (team_id, wave, item)
);
