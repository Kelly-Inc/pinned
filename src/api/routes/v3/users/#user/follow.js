// Follow (PUT/POST) or unfollow (DELETE) a user.
import { findUser, followUser, unfollowUser, getUser } from '../../../../../database/index.js';
import { userShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

function target(ctx) {
  const user = findUser(ctx.params.user);
  if (!user) throw notFound('User not found');
  return user;
}

export function put(ctx) {
  const user = target(ctx);
  followUser(user.id);
  return userShape(getUser(user.id), ctx.origin);
}

export function del(ctx) {
  const user = target(ctx);
  unfollowUser(user.id);
  return userShape(getUser(user.id), ctx.origin);
}
