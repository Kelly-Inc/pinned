import { getBoard } from '../../database/index.js';
import { boardShape } from '../../schemas/index.js';

export const match = /Board/;
export const priority = 70;

export function resolve(ctx) {
  const board = getBoard(ctx.data.boardId || Object.values(ctx.data)[0]);
  return { board: board ? boardShape(board, ctx.origin) : null };
}
