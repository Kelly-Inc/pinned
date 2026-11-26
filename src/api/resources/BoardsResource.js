// A user's boards (the Boards tab and pickers).
import { getBoards, resolveUser } from '../../database/index.js';
import { boardShape } from '../../schemas/index.js';

export const aliases = ['BoardsFeedResource'];

export function get(ctx) {
  const user = resolveUser(ctx.options.username || ctx.options.user_id);
  return getBoards(user.id).map((board) => boardShape(board, ctx.origin));
}
