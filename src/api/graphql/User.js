import { resolveUser } from '../../database/index.js';
import { userShape } from '../../schemas/index.js';

export const match = /User/;
export const priority = 60;

export function resolve(ctx) {
  const v = ctx.data;
  return { user: userShape(resolveUser(v.username || v.userId || v.id), ctx.origin) };
}
