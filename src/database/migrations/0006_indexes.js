// Indexes for the hot lookups: feeds, counts, follows and sessions.
export default {
  id: '0006_indexes',
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pins_pinner ON pins(pinner_id);
      CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);
      CREATE INDEX IF NOT EXISTS idx_saves_pin ON saves(pin_id);
      CREATE INDEX IF NOT EXISTS idx_likes_pin ON likes(pin_id);
      CREATE INDEX IF NOT EXISTS idx_comments_pin ON comments(pin_id);
      CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
    `);
  },
};
