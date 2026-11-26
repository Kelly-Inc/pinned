import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.PINTERESTD_DB || path.join(ROOT, 'data', 'pinterestd.sqlite');
const SEED_PATH = path.join(ROOT, 'data', 'seed.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    full_name   TEXT NOT NULL,
    avatar      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_secret   INTEGER NOT NULL DEFAULT 0,
    cover_pin_id TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
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

export const requestUser = new AsyncLocalStorage();
export function currentUserId() {
  const id = requestUser.getStore();
  if (!id) throw new Error('not authenticated');
  return id;
}

// Accounts: passwords hashed with scrypt, sessions stored server-side.
for (const sql of [
  'ALTER TABLE users ADD COLUMN password_hash TEXT',
  "ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN about TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN website_url TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN settings TEXT NOT NULL DEFAULT '{}'",
]) { try { db.exec(sql); } catch {} }
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (follower_id, followee_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE);
`);
// The old shared "P" avatar is replaced by a generated per-user initial avatar.
db.prepare("UPDATE users SET avatar = NULL WHERE avatar = '/media/avatar.svg'").run();
// Remove the old built-in "Local User" account (no password, never loginable).
db.prepare("DELETE FROM users WHERE id = '1' AND username = 'localuser' AND password_hash IS NULL").run();

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored || '').split('$');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function createAccount({ username, fullName, password }) {
  username = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    return { error: 'Username must be 3-30 letters, numbers or underscores.' };
  }
  if (String(password || '').length < 8) return { error: 'Password must be at least 8 characters.' };
  if (getUserByUsername(username)) return { error: 'That username is taken.' };
  const id = String(Date.now()) + String(crypto.randomInt(1000, 9999));
  db.prepare(`
    INSERT INTO users (id, username, full_name, avatar, password_hash) VALUES (?, ?, ?, ?, ?)
  `).run(id, username, String(fullName || '').trim() || username, null, hashPassword(password));
  return { user: getUser(id) };
}

export function authenticate(username, password) {
  const user = getUserByUsername(String(username || '').trim());
  if (!user || !user.password_hash || !verifyPassword(String(password || ''), user.password_hash)) return null;
  return user;
}

export const SESSION_DAYS = 30;
export function purgeExpiredSessions() {
  db.prepare(`DELETE FROM sessions WHERE created_at <= datetime('now', '-${SESSION_DAYS} days')`).run();
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, String(userId));
  return token;
}

export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT user_id FROM sessions WHERE token = ?
    AND created_at > datetime('now', '-${SESSION_DAYS} days')`).get(String(token));
  return row ? getUser(row.user_id) : null;
}

const PROFILE_FIELDS = ['first_name', 'last_name', 'about', 'website_url'];

export function getSettings(userId = currentUserId()) {
  const user = getUser(userId);
  if (!user) return null;
  let extra = {};
  try { extra = JSON.parse(user.settings || '{}'); } catch {}
  const [first, ...rest] = String(user.full_name || '').split(/\s+/);
  return {
    ...extra,
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    first_name: user.first_name || first || '',
    last_name: user.last_name || rest.join(' '),
    about: user.about || '',
    website_url: user.website_url || '',
    email: extra.email || '',
    profile_image_url: user.avatar || null,
  };
}

/** Apply a UserSettingsResource update. Returns { settings } or { error }. */
export function updateSettings(fields) {
  const id = currentUserId();
  const user = getUser(id);
  const current = getSettings(id);
  const next = {};
  for (const k of PROFILE_FIELDS) {
    if (fields[k] !== undefined) next[k] = String(fields[k] ?? '').slice(0, k === 'about' ? 500 : 100).trim();
  }
  if (fields.username !== undefined && String(fields.username).trim() !== user.username) {
    const name = String(fields.username).trim();
    if (!/^[A-Za-z0-9_]{3,30}$/.test(name)) return { error: 'Username must be 3-30 letters, numbers or underscores.' };
    const taken = getUserByUsername(name);
    if (taken && taken.id !== id) return { error: 'That username is taken.' };
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(name, id);
  }
  const merged = { ...current, ...next };
  const fullName = `${merged.first_name} ${merged.last_name}`.trim() || user.username;
  db.prepare(`UPDATE users SET first_name = ?, last_name = ?, about = ?, website_url = ?, full_name = ? WHERE id = ?`)
    .run(merged.first_name, merged.last_name, merged.about, merged.website_url, fullName, id);
  // Everything else (notification/privacy toggles etc.) is stored as-is.
  let extra = {};
  try { extra = JSON.parse(user.settings || '{}'); } catch {}
  if (fields.profile_image_url === '' || fields.profile_image_url === null) {
    db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(id);
  }
  const skip = new Set(['profile_image_url', ...PROFILE_FIELDS, 'username', 'surface_tag', 'full_name', 'id', 'options', 'context', 'data']);
  for (const [k, v] of Object.entries(fields)) {
    if (!skip.has(k) && (v === null || ['string', 'number', 'boolean'].includes(typeof v))) extra[k] = v;
  }
  db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(extra), id);
  return { settings: getSettings(id) };
}

export function followUser(followeeId) {
  const me = currentUserId();
  if (!getUser(followeeId) || String(followeeId) === me) return false;
  db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)').run(me, String(followeeId));
  return true;
}

export function unfollowUser(followeeId) {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(currentUserId(), String(followeeId));
  return true;
}

export function followCounts(userId) {
  const q = (col) => db.prepare(`SELECT COUNT(*) AS n FROM follows WHERE ${col} = ?`).get(String(userId)).n;
  return { followers: q('followee_id'), following: q('follower_id') };
}

export function isFollowing(followeeId) {
  return !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?')
    .get(currentUserId(), String(followeeId));
}

export function listFollowing(userId) {
  return db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id
    WHERE f.follower_id = ? ORDER BY f.created_at DESC`).all(String(userId));
}

export function listFollowers(userId) {
  return db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.followee_id = ? ORDER BY f.created_at DESC`).all(String(userId));
}

export function deleteSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(String(token));
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(String(id)) || null;
}

export function getUserByUsername(username) {
  if (!username) return null;
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(String(username)) || null;
}

export function listPins({ limit = 100, offset = 0, tag = null } = {}) {
  if (tag) {
    return db.prepare(`
      SELECT * FROM pins
      WHERE tags LIKE ?
      ORDER BY rowid DESC LIMIT ? OFFSET ?
    `).all(`%"${tag}"%`, limit, offset);
  }
  return db.prepare('SELECT * FROM pins ORDER BY rowid DESC LIMIT ? OFFSET ?').all(limit, offset);
}

export function getPin(id) {
  return db.prepare('SELECT * FROM pins WHERE id = ?').get(String(id)) || null;
}

export function countPins() {
  return db.prepare('SELECT COUNT(*) AS n FROM pins').get().n;
}

export function getBoards(userId = currentUserId()) {
  return db.prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
}

export function getBoard(id) {
  return db.prepare('SELECT * FROM boards WHERE id = ?').get(String(id)) || null;
}

export function slugifyBoardName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getBoardBySlug(usernameOrId, slug) {
  const user = getUser(usernameOrId) || getUserByUsername(usernameOrId);
  if (!user || !slug) return null;
  const target = slugifyBoardName(decodeURIComponent(String(slug)));
  return getBoards(user.id).find((board) => slugifyBoardName(board.name) === target) || null;
}

export function createBoard({ name, description = '', isSecret = false }) {
  const id = String(Date.now());
  db.prepare(`
    INSERT INTO boards (id, user_id, name, description, is_secret)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, currentUserId(), name, description, isSecret ? 1 : 0);
  return getBoard(id);
}

export function ownBoard(id) {
  const board = getBoard(id);
  return board && board.user_id === currentUserId() ? board : null;
}

export function updateBoard(id, fields) {
  const board = ownBoard(id);
  if (!board) return null;
  const name = String(fields.name ?? board.name).trim() || board.name;
  const description = fields.description ?? board.description;
  const isSecret = fields.privacy ? (fields.privacy === 'secret' ? 1 : 0)
    : fields.is_secret !== undefined ? (fields.is_secret ? 1 : 0) : board.is_secret;
  db.prepare("UPDATE boards SET name = ?, description = ?, is_secret = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, description, isSecret, String(id));
  return getBoard(id);
}

export function deleteBoard(id) {
  if (!ownBoard(id)) return false;
  db.prepare('DELETE FROM boards WHERE id = ?').run(String(id));
  return true;
}

export function ownPin(id) {
  const pin = getPin(id);
  return pin && pin.pinner_id === currentUserId() ? pin : null;
}

export function updatePin(id, fields) {
  const pin = ownPin(id);
  if (!pin) return null;
  db.prepare('UPDATE pins SET title = ?, description = ?, link = ? WHERE id = ?').run(
    String(fields.title ?? pin.title), String(fields.description ?? pin.description),
    String(fields.link ?? pin.link), String(id));
  return getPin(id);
}

export function deletePin(id) {
  if (!ownPin(id)) return false;
  db.prepare('DELETE FROM pins WHERE id = ?').run(String(id));
  return true;
}

export function pinCounts(pinId) {
  const id = String(pinId);
  return db.prepare(`SELECT
      (SELECT COUNT(*) FROM likes WHERE pin_id = ?) AS likes,
      (SELECT COUNT(*) FROM comments WHERE pin_id = ?) AS comments,
      (SELECT COUNT(*) FROM saves s JOIN pins p ON p.id = s.pin_id
        WHERE s.pin_id = ? AND s.user_id != p.pinner_id) AS saves`).get(id, id, id);
}

export function savePin({ pinId, boardId = null }) {
  if (!getPin(pinId)) return false;
  if (boardId && !ownBoard(boardId)) return false;
  db.prepare(`
    INSERT INTO saves (user_id, pin_id, board_id)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, pin_id) DO UPDATE SET board_id = excluded.board_id
  `).run(currentUserId(), String(pinId), boardId ? String(boardId) : null);
  if (boardId) {
    db.prepare("UPDATE boards SET cover_pin_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(String(pinId), String(boardId));
  }
  return true;
}

export function unsavePin(pinId) {
  db.prepare('DELETE FROM saves WHERE user_id = ? AND pin_id = ?').run(currentUserId(), String(pinId));
  return true;
}

export function isSaved(pinId) {
  return !!db.prepare('SELECT 1 FROM saves WHERE user_id = ? AND pin_id = ?')
    .get(currentUserId(), String(pinId));
}

export function isLiked(pinId) {
  return !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND pin_id = ?')
    .get(currentUserId(), String(pinId));
}

export function setLike(pinId, liked) {
  if (!getPin(pinId)) return false;
  if (liked) db.prepare('INSERT OR IGNORE INTO likes (user_id, pin_id) VALUES (?, ?)').run(currentUserId(), String(pinId));
  else db.prepare('DELETE FROM likes WHERE user_id = ? AND pin_id = ?').run(currentUserId(), String(pinId));
  return true;
}

export function getComment(id) {
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(id)) || null;
}

export function deleteComment(id) {
  const c = getComment(id);
  if (!c) return false;
  const pin = getPin(c.pin_id);
  // Comment author or the pin's owner may delete it.
  if (c.user_id !== currentUserId() && pin?.pinner_id !== currentUserId()) return false;
  db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
  return true;
}

export function toggleLike(pinId) {
  if (isLiked(pinId)) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND pin_id = ?').run(currentUserId(), String(pinId));
    return false;
  }
  db.prepare('INSERT INTO likes (user_id, pin_id) VALUES (?, ?)').run(currentUserId(), String(pinId));
  return true;
}

export function addComment(pinId, text) {
  text = String(text || '').trim();
  if (!text || !getPin(pinId)) return null;
  db.prepare('INSERT INTO comments (user_id, pin_id, text) VALUES (?, ?, ?)')
    .run(currentUserId(), String(pinId), String(text));
  return db.prepare('SELECT * FROM comments WHERE pin_id = ? ORDER BY id DESC').all(String(pinId));
}

export function getComments(pinId) {
  return db.prepare('SELECT * FROM comments WHERE pin_id = ? ORDER BY id DESC').all(String(pinId));
}

export function seedDatabase({ force = false } = {}) {
  if (countPins() > 0 && !force) return { inserted: 0, skipped: true };
  if (!fs.existsSync(SEED_PATH)) return { inserted: 0, skipped: true, reason: 'missing seed file' };
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, full_name, avatar) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const insertPin = db.prepare(`
    INSERT INTO pins (id, title, description, link, image_path, width, height,
                      dominant_color, pinner_id, created_at, repin_count, like_count,
                      comment_count, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  let inserted = 0;
  db.exec('BEGIN');
  try {
    for (const row of seed.pinners || []) {
      insertUser.run(row.id, row.username, row.full_name, row.avatar || null);
    }
    for (const pin of seed.pins || []) {
      insertPin.run(
        String(pin.id), pin.title || '', pin.description || '', pin.link || '',
        pin.image_path || '', pin.width || 600, pin.height || 900,
        pin.dominant_color || '#efefef', String(pin.pinner_id || currentUserId()),
        pin.created_at || 'Mon, 01 Jan 2024 00:00:00 +0000',
        pin.repin_count || 0, pin.like_count || 0, pin.comment_count || 0,
        JSON.stringify(pin.tags || []),
      );
      inserted += 1;
    }
    for (const board of seed.boards || []) {
      db.prepare(`
        INSERT INTO boards (id, user_id, name, description) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(String(board.id), currentUserId(), board.name, board.description || '');
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { inserted, skipped: false };
}
