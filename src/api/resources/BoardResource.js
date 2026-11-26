// One board: read (by id, or username + slug), create, edit, delete.
import { getBoard, getBoardBySlug, getBoards, resolveUser, createBoard, updateBoard, deleteBoard } from '../../database/index.js';
import { boardShape } from '../../schemas/index.js';
import { forbidden, badRequest } from '../../util/errors.js';
import { clean } from '../../util/text.js';
import { LIMITS } from '../../config.js';

function find(options) {
  const byId = getBoard(options.board_id || options.id || options.boardId);
  if (byId) return byId;
  const identity = options.username || options.user_id || options.userId;
  const slug = options.slug || options.board_slug || options.boardSlug;
  if (identity && slug) return getBoardBySlug(identity, slug);
  if (identity) return getBoards(resolveUser(identity).id)[0] || null;
  return null;
}

export function get(ctx) {
  return boardShape(find(ctx.options), ctx.origin);
}

export function create(ctx) {
  const name = clean(ctx.data.name, LIMITS.titleChars);
  if (!name) throw badRequest('Board name is required');
  const board = createBoard({
    name,
    description: clean(ctx.data.description, LIMITS.descriptionChars),
    isSecret: ctx.data.privacy === 'secret' || !!ctx.data.is_secret,
  });
  return boardShape(board, ctx.origin);
}

export function update(ctx) {
  const board = updateBoard(ctx.data.board_id, ctx.data);
  if (!board) throw forbidden();
  return boardShape(board, ctx.origin);
}

export function remove(ctx) {
  if (!deleteBoard(ctx.data.board_id)) throw forbidden();
  return null;
}
