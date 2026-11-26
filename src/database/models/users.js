import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { newId } from '../../util/ids.js';

export function getUser(id) {
  if (id === undefined || id === null) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(String(id)) || null;
}

export function getUserByUsername(username) {
  if (!username) return null;
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username)) || null;
}

/** Look a user up by id or username ("me" means the current user). */
export function findUser(identity) {
  if (identity === undefined || identity === null || identity === '') return null;
  const value = decodeURIComponent(String(identity));
  if (value === 'me') return getUser(currentUserId());
  return getUser(value) || getUserByUsername(value);
}

/** Like findUser, but falls back to the current user. */
export function resolveUser(identity) {
  return findUser(identity) || getUser(currentUserId());
}

export function me() {
  return getUser(currentUserId());
}

export function createUser({ username, fullName, passwordHash }) {
  const id = newId();
  db.prepare('INSERT INTO users (id, username, full_name, avatar, password_hash) VALUES (?, ?, ?, NULL, ?)')
    .run(id, username, fullName || username, passwordHash);
  return getUser(id);
}

export function setUsername(id, username) {
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, String(id));
}

export function setAvatar(id, avatarPath) {
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarPath, String(id));
}

export function updateProfile(id, { firstName, lastName, about, websiteUrl, fullName }) {
  db.prepare(`UPDATE users SET first_name = ?, last_name = ?, about = ?, website_url = ?, full_name = ? WHERE id = ?`)
    .run(firstName, lastName, about, websiteUrl, fullName, String(id));
}

export function setSettingsJson(id, json) {
  db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(json, String(id));
}

export function firstAccount() {
  return db.prepare('SELECT * FROM users WHERE password_hash IS NOT NULL ORDER BY created_at LIMIT 1').get() || null;
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL').get().n;
}

// Search local account names for message recipients without exposing private fields.
export function searchMessageRecipients(term, limit) {
  return db.prepare(`
    SELECT * FROM users
    WHERE id != ? AND password_hash IS NOT NULL
      AND (instr(lower(username), lower(?)) > 0 OR instr(lower(full_name), lower(?)) > 0)
    ORDER BY lower(username) LIMIT ?
  `).all(currentUserId(), term, term, limit);
}
