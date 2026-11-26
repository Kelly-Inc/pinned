import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { newId } from '../../util/ids.js';

export function getPin(id) {
  if (id === undefined || id === null || id === '') return null;
  return db.prepare('SELECT * FROM pins WHERE id = ?').get(String(id)) || null;
}

export function countPins() {
  return db.prepare('SELECT COUNT(*) AS n FROM pins').get().n;
}

export function countPinsBy(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM pins WHERE pinner_id = ?').get(String(userId)).n;
}

/** Newest pins across the instance (the home feed). */
export function listPins({ limit = 100, offset = 0 } = {}) {
  return db.prepare('SELECT * FROM pins ORDER BY rowid DESC LIMIT ? OFFSET ?').all(limit, offset);
}

/** A profile's Pins tab: pins the user created plus pins they saved, newest first. */
export function profilePins(userId, limit = 500) {
  return db.prepare(`
    SELECT p.*, MAX(t.at) AS sort_at FROM pins p JOIN (
      SELECT id AS pin_id, created_at AS at FROM pins WHERE pinner_id = ?
      UNION ALL
      SELECT pin_id, created_at AS at FROM saves WHERE user_id = ?
    ) t ON t.pin_id = p.id
    GROUP BY p.id ORDER BY sort_at DESC, p.rowid DESC LIMIT ?
  `).all(String(userId), String(userId), limit);
}

export function boardPins(boardId, limit = 200) {
  return db.prepare(`
    SELECT p.* FROM pins p JOIN saves s ON s.pin_id = p.id
    WHERE s.board_id = ? ORDER BY s.created_at DESC, s.id DESC LIMIT ?
  `).all(String(boardId), limit);
}

/** Case-insensitive match on title, description and tags; any word matches. */
export function searchPins(query, limit = 100) {
  const needles = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!needles.length) return listPins({ limit });
  return db.prepare('SELECT * FROM pins ORDER BY rowid DESC LIMIT 500').all()
    .filter((pin) => {
      const haystack = `${pin.title} ${pin.description} ${pin.tags}`.toLowerCase();
      return needles.some((needle) => haystack.includes(needle));
    })
    .slice(0, limit);
}

export function createPin({ title = '', description = '', link = '', imagePath = '', width = 600, height = 900, tags = [] }) {
  const id = newId();
  db.prepare(`
    INSERT INTO pins (id, title, description, link, image_path, width, height, pinner_id, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description, link, imagePath, width, height, currentUserId(), JSON.stringify(tags));
  return getPin(id);
}

/** The pin if the current user owns it. */
export function ownPin(id) {
  const pin = getPin(id);
  return pin && pin.pinner_id === currentUserId() ? pin : null;
}

export function updatePin(id, fields) {
  const pin = ownPin(id);
  if (!pin) return null;
  db.prepare('UPDATE pins SET title = ?, description = ?, link = ? WHERE id = ?').run(
    String(fields.title ?? pin.title),
    String(fields.description ?? pin.description),
    String(fields.link ?? pin.link),
    String(id),
  );
  return getPin(id);
}

export function deletePin(id) {
  if (!ownPin(id)) return false;
  db.prepare('DELETE FROM pins WHERE id = ?').run(String(id));
  return true;
}

/** Live engagement counts; never trusts the legacy counter columns. */
export function pinCounts(pinId) {
  const id = String(pinId);
  return db.prepare(`SELECT
      (SELECT COUNT(*) FROM likes WHERE pin_id = ?) AS likes,
      (SELECT COUNT(*) FROM comments WHERE pin_id = ?) AS comments,
      (SELECT COUNT(*) FROM saves s JOIN pins p ON p.id = s.pin_id
        WHERE s.pin_id = ? AND s.user_id != p.pinner_id) AS saves`).get(id, id, id);
}

export function pinTags(pin) {
  try { return JSON.parse(pin.tags || '[]'); } catch { return []; }
}
