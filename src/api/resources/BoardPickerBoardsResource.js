// The "save to board" flyout reads all_boards and boards_shortlist.
import { getBoards } from '../../database/index.js';
import { boardShape } from '../../schemas/index.js';

export function get(ctx) {
  const boards = getBoards().map((board) => boardShape(board, ctx.origin));
  return { all_boards: boards, boards_shortlist: boards };
}
