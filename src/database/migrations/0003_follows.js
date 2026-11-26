export default {
  id: '0003_follows',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS follows (
        follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (follower_id, followee_id)
      );
    `);
  },
};
