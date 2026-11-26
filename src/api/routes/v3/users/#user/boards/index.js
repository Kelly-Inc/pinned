import { resolveUser, getBoards } from '../../../../../../database/index.js';
import { boardShape } from '../../../../../../schemas/index.js';

export const get = (ctx) => getBoards(resolveUser(ctx.params.user).id).map((b) => boardShape(b, ctx.origin));
