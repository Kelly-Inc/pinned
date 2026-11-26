export default {
  id: '0005_uploads',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS uploads (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status      TEXT NOT NULL DEFAULT 'registered',
        image_path  TEXT,
        width       INTEGER,
        height      INTEGER,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};
