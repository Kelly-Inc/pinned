import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { getPin } from './pins.js';
import { LIMITS } from '../../config.js';

export function getComment(id) {
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(id)) || null;
}

export function listComments(pinId) {
  return db.prepare('SELECT * FROM comments WHERE pin_id = ? ORDER BY id DESC').all(String(pinId));
}

/** Add a comment. Returns the new comment, or null if empty / pin missing. */
export function addComment(pinId, text) {
  const body = String(text || '').trim().slice(0, LIMITS.commentChars);
  if (!body || !getPin(pinId)) return null;
  const { lastInsertRowid } = db.prepare('INSERT INTO comments (user_id, pin_id, text) VALUES (?, ?, ?)')
    .run(currentUserId(), String(pinId), body);
  return getComment(lastInsertRowid);
}

/** The author or the pin's owner may delete a comment. */
export function deleteComment(id) {
  const comment = getComment(id);
  if (!comment) return false;
  const pin = getPin(comment.pin_id);
  const me = currentUserId();
  if (comment.user_id !== me && pin?.pinner_id !== me) return false;
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  return true;
}
