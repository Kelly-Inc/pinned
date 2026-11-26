import { db } from '../connection.js';
import { randomToken } from '../../util/ids.js';
import { SESSION_DAYS } from '../../config.js';
import { getUser } from './users.js';

const FRESH = `created_at > datetime('now', '-${SESSION_DAYS} days')`;

export function createSession(userId) {
  const token = randomToken(32);
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, String(userId));
  return token;
}

/** The user behind a session token, or null if missing or expired. */
export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT user_id FROM sessions WHERE token = ? AND ${FRESH}`).get(String(token));
  return row ? getUser(row.user_id) : null;
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token));
}

export function purgeExpiredSessions() {
  return db.prepare(`DELETE FROM sessions WHERE NOT (${FRESH})`).run().changes;
}
