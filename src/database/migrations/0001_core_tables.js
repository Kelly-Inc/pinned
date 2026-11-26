export default {
  id: '0001_core_tables',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        username    TEXT NOT NULL,
        full_name   TEXT NOT NULL,
        avatar      TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS boards (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        is_secret    INTEGER NOT NULL DEFAULT 0,
        cover_pin_id TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS pins (
        id             TEXT PRIMARY KEY,
        title          TEXT NOT NULL DEFAULT '',
        description    TEXT NOT NULL DEFAULT '',
        link           TEXT NOT NULL DEFAULT '',
        image_path     TEXT NOT NULL DEFAULT '',
        width          INTEGER NOT NULL DEFAULT 600,
        height         INTEGER NOT NULL DEFAULT 900,
        dominant_color TEXT NOT NULL DEFAULT '#efefef',
        pinner_id      TEXT NOT NULL REFERENCES users(id),
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        repin_count    INTEGER NOT NULL DEFAULT 0,
        like_count     INTEGER NOT NULL DEFAULT 0,
        comment_count  INTEGER NOT NULL DEFAULT 0,
        tags           TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS saves (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin_id     TEXT NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        board_id   TEXT REFERENCES boards(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, pin_id)
      );

      CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin_id  TEXT NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, pin_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin_id     TEXT NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        text       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_pins_tags ON pins(tags);
      CREATE INDEX IF NOT EXISTS idx_saves_board ON saves(board_id);
    `);
  },
};
