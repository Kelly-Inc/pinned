import { getBoard } from '../../../../../database/index.js';
import { boardShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

export function get(ctx) {
  const board = getBoard(ctx.params.board);
  if (!board) throw notFound('Board not found');
  return boardShape(board, ctx.origin);
}
