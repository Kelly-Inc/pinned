// A user's public profile.
import { findUser } from '../../../../../database/index.js';
import { userShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

export function get(ctx) {
  const user = findUser(ctx.params.user);
  if (!user) throw notFound('User not found');
  return userShape(user, ctx.origin);
}
