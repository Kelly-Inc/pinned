// A user's Pins tab: pins they created plus pins they saved.
import { resolveUser, profilePins, boardPins } from '../../database/index.js';
import { pinsShape } from '../../schemas/index.js';

export const aliases = ['RelatedStreamResource', 'CategoryFeedResource', 'TodayArticleFeedResource'];

export function get(ctx) {
  const { board_id: boardId, user_id: userId, username } = ctx.options;
  if (boardId) return pinsShape(boardPins(boardId), ctx.origin);
  return pinsShape(profilePins(resolveUser(userId || username).id), ctx.origin);
}
