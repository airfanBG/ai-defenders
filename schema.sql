-- Безопасно е да се пуска многократно: не трие нищо.
CREATE TABLE IF NOT EXISTS teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  members     TEXT NOT NULL,           -- JSON масив: [{name, email, school, grade}]
  mentor      TEXT,
  idea        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved
  ip_hash     TEXT,
  notified_at TEXT,                    -- кога е пратено писмото за одобрение/отказ
  broadcast_at TEXT,                   -- кога е пратено писмото до всички
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_ip ON teams(ip_hash, created_at);

-- Настройките на сайта от админ панела (име, дати, програма, награди...).
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- След това пусни и файловете в migrations/ (по веднъж, по ред).

-- Отговорите от анкетата след хакатона (виж migrations/005_feedback.sql).
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  answers     TEXT NOT NULL,
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_ip ON feedback(ip_hash, created_at);

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

-- Кой е попълнил анкетата през личния си линк от напомнянето. Отделно от отговорите,
-- за да останат те анонимни: тук е само „този човек е попълнил“, без връзка към отговора.
CREATE TABLE IF NOT EXISTS feedback_done (
  ref         TEXT PRIMARY KEY,         -- личният ключ от линка (хеш от имейла)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ключове на екипите за общия модел (/api/llm) и запис на заявките.
CREATE TABLE IF NOT EXISTS llm_keys (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL,                 -- за кого е ключът (екип)
  team_id     INTEGER,                       -- одобреният екип, на който е даден ключът
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

-- Арената „Пазителят на тайната“: адресът на асистента и тайната на всеки екип, и резултатите от атаките.
CREATE TABLE IF NOT EXISTS arena_targets (
  team_id     INTEGER PRIMARY KEY,          -- одобрен екип
  endpoint    TEXT,                         -- адресът на асистента им (POST {"message"} → {"reply"})
  secret      TEXT NOT NULL,                -- тайната, която асистентът пази
  access_code TEXT,                         -- кодът за достъп: с него служител получава тайната
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
