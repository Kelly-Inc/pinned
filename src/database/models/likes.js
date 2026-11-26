import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { getPin } from './pins.js';

/** Like or unlike. Idempotent. False if the pin does not exist. */
export function setLike(pinId, liked) {
  if (!getPin(pinId)) return false;
  if (liked) db.prepare('INSERT OR IGNORE INTO likes (user_id, pin_id) VALUES (?, ?)').run(currentUserId(), String(pinId));
  else db.prepare('DELETE FROM likes WHERE user_id = ? AND pin_id = ?').run(currentUserId(), String(pinId));
  return true;
}

export function isLiked(pinId) {
  return !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND pin_id = ?').get(currentUserId(), String(pinId));
}
