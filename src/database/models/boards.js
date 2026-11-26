import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { newId } from '../../util/ids.js';
import { slugify } from '../../util/text.js';
import { findUser } from './users.js';

export function getBoard(id) {
  if (id === undefined || id === null || id === '') return null;
  return db.prepare('SELECT * FROM boards WHERE id = ?').get(String(id)) || null;
}

export function getBoards(userId = currentUserId()) {
  return db.prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY updated_at DESC').all(String(userId));
}

export function countBoards(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM boards WHERE user_id = ?').get(String(userId)).n;
}

export function getBoardBySlug(identity, slug) {
  const user = findUser(identity);
  if (!user || !slug) return null;
  const target = slugify(decodeURIComponent(String(slug)));
  return getBoards(user.id).find((board) => slugify(board.name) === target) || null;
}

/** The board if the current user owns it. */
export function ownBoard(id) {
  const board = getBoard(id);
  return board && board.user_id === currentUserId() ? board : null;
}

export function createBoard({ name, description = '', isSecret = false }) {
  const id = newId();
  db.prepare('INSERT INTO boards (id, user_id, name, description, is_secret) VALUES (?, ?, ?, ?, ?)')
    .run(id, currentUserId(), name, description, isSecret ? 1 : 0);
  return getBoard(id);
}

export function updateBoard(id, fields) {
  const board = ownBoard(id);
  if (!board) return null;
  const name = String(fields.name ?? board.name).trim() || board.name;
  const description = fields.description ?? board.description;
  let isSecret = board.is_secret;
  if (fields.privacy) isSecret = fields.privacy === 'secret' ? 1 : 0;
  else if (fields.is_secret !== undefined) isSecret = fields.is_secret ? 1 : 0;
  db.prepare("UPDATE boards SET name = ?, description = ?, is_secret = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, description, isSecret, String(id));
  return getBoard(id);
}

export function deleteBoard(id) {
  if (!ownBoard(id)) return false;
  db.prepare('DELETE FROM boards WHERE id = ?').run(String(id));
  return true;
}

export function setBoardCover(boardId, pinId) {
  db.prepare("UPDATE boards SET cover_pin_id = ?, updated_at = datetime('now') WHERE id = ?").run(String(pinId), String(boardId));
}

export function boardPinCount(boardId) {
  return db.prepare('SELECT COUNT(*) AS n FROM saves WHERE board_id = ?').get(String(boardId)).n;
}

export function boardPreviewPins(boardId, limit = 4) {
  return db.prepare(`
    SELECT p.* FROM pins p JOIN saves s ON s.pin_id = p.id
    WHERE s.board_id = ? ORDER BY s.id DESC LIMIT ?
  `).all(String(boardId), limit);
}
