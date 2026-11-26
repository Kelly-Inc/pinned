import { resolveUser, listFollowing } from '../../../../../database/index.js';
import { userShape } from '../../../../../schemas/index.js';

export const get = (ctx) => listFollowing(resolveUser(ctx.params.user).id).map((u) => userShape(u, ctx.origin));
