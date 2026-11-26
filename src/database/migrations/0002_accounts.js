import { addColumn } from '../connection.js';

// Real accounts: password hashes, server-side sessions, unique usernames.
export default {
  id: '0002_accounts',
  up(db) {
    addColumn('users', 'password_hash', 'TEXT');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
    `);
    // The old built-in "Local User" had no password and could never log in.
    db.prepare("DELETE FROM users WHERE id = '1' AND username = 'localuser' AND password_hash IS NULL").run();
    // The old shared "P" avatar is replaced by generated per-user avatars.
    db.prepare("UPDATE users SET avatar = NULL WHERE avatar = '/media/avatar.svg'").run();
  },
};
