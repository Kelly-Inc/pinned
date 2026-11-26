// The star on a saved pin is independent of its heart reaction.
export default {
  id: '0007_pin_favorites',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pin_favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pin_id TEXT NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, pin_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pin_favorites_pin ON pin_favorites(pin_id);
    `);
  },
};
