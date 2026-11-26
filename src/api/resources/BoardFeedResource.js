// Pins saved into one board.
import { boardPins } from '../../database/index.js';
import { pinsShape } from '../../schemas/index.js';

export const aliases = ['BoardSectionPinsResource'];

export function get(ctx) {
  const boardId = ctx.options.board_id || ctx.options.id;
  return boardId ? pinsShape(boardPins(boardId), ctx.origin) : [];
}
