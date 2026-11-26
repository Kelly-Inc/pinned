// Save someone's pin, optionally into one of your boards.
import { savePin } from '../../database/index.js';
import { forbidden } from '../../util/errors.js';

export function create(ctx) {
  const pinId = ctx.data.pin_id || ctx.data.pinId;
  if (!savePin({ pinId, boardId: ctx.data.board_id || null })) throw forbidden();
  return { pin_id: String(pinId) };
}
