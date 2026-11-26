export default {
  id: '0009_conversations',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        participant_key TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read INTEGER NOT NULL DEFAULT 0,
        last_seen INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        pin_id TEXT REFERENCES pins(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread ON conversation_messages(conversation_id, id DESC);
    `);
  },
};
