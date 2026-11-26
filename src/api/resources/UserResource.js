// A user's public profile, with their boards.
import { resolveUser, getBoards } from '../../database/index.js';
import { userShape, boardShape } from '../../schemas/index.js';

export const aliases = ['ActiveUserResource'];

export function get(ctx) {
  const user = resolveUser(ctx.options.user_id || ctx.options.username);
  return { ...userShape(user, ctx.origin), boards: getBoards(user.id).map((b) => boardShape(b, ctx.origin)) };
}
