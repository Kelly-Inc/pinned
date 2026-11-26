export default {
  id: '0008_activity_notifications',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('follow', 'comment')),
        pin_id TEXT REFERENCES pins(id) ON DELETE CASCADE,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        unread INTEGER NOT NULL DEFAULT 1,
        hidden INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_activity_recipient ON activity_notifications(recipient_id, id DESC);
    `);
  },
};
