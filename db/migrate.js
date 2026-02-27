const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'axexvx.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    original    TEXT    NOT NULL,
    domain      TEXT    NOT NULL DEFAULT 'axexvx.link',
    alias       TEXT,
    password    TEXT,
    expires_at  INTEGER,
    max_clicks  INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    is_active   INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id     INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    ip          TEXT,
    user_agent  TEXT,
    referer     TEXT,
    country     TEXT,
    device      TEXT
  );

  CREATE TABLE IF NOT EXISTS sms_campaigns (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    sender_id     TEXT    NOT NULL,
    message       TEXT    NOT NULL,
    phone_numbers TEXT    NOT NULL,
    scheduled_at  INTEGER,
    sent_at       INTEGER,
    status        TEXT    NOT NULL DEFAULT 'pending',
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS apk_files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name      TEXT    NOT NULL,
    version       TEXT    NOT NULL,
    file_size     INTEGER,
    min_android   TEXT,
    sha256        TEXT,
    scan_status   TEXT    NOT NULL DEFAULT 'pending',
    download_url  TEXT    NOT NULL,
    short_code    TEXT,
    downloads     INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_links_code     ON links(code);
  CREATE INDEX IF NOT EXISTS idx_links_domain   ON links(domain);
  CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
  CREATE INDEX IF NOT EXISTS idx_clicks_at      ON clicks(clicked_at);
`);

console.log('✅ Database migrated successfully at:', DB_PATH);
db.close();
