// Your boards; POST creates one.
import { getBoards, createBoard } from '../../../../database/index.js';
import { boardShape } from '../../../../schemas/index.js';
import { badRequest } from '../../../../util/errors.js';
import { clean } from '../../../../util/text.js';
import { LIMITS } from '../../../../config.js';

export const get = (ctx) => getBoards().map((b) => boardShape(b, ctx.origin));

export function post(ctx) {
  const name = clean(ctx.data.name, LIMITS.titleChars);
  if (!name) throw badRequest('Board name is required');
  const board = createBoard({ name, description: clean(ctx.data.description, LIMITS.descriptionChars), isSecret: ctx.data.privacy === 'secret' });
  return boardShape(board, ctx.origin);
}
