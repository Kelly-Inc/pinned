import { resolveUser, listFollowers } from '../../database/index.js';
import { userShape } from '../../schemas/index.js';

export function get(ctx) {
  const user = resolveUser(ctx.options.username || ctx.options.user_id);
  return listFollowers(user.id).map((u) => userShape(u, ctx.origin));
}
