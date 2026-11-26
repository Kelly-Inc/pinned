import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { getPin } from './pins.js';
import { ownBoard, setBoardCover } from './boards.js';

/** Save a pin (optionally into one of your boards). False if not allowed. */
export function savePin({ pinId, boardId = null }) {
  if (!getPin(pinId)) return false;
  if (boardId && !ownBoard(boardId)) return false;
  db.prepare(`
    INSERT INTO saves (user_id, pin_id, board_id) VALUES (?, ?, ?)
    ON CONFLICT(user_id, pin_id) DO UPDATE SET board_id = excluded.board_id
  `).run(currentUserId(), String(pinId), boardId ? String(boardId) : null);
  if (boardId) setBoardCover(boardId, pinId);
  return true;
}

export function unsavePin(pinId) {
  db.prepare('DELETE FROM saves WHERE user_id = ? AND pin_id = ?').run(currentUserId(), String(pinId));
  return true;
}

export function isSaved(pinId) {
  return !!db.prepare('SELECT 1 FROM saves WHERE user_id = ? AND pin_id = ?').get(currentUserId(), String(pinId));
}
