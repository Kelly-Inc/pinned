// Save a pin, optionally into one of your boards.
import { savePin } from '../../../../../database/index.js';
import { forbidden } from '../../../../../util/errors.js';

export function post(ctx) {
  if (!savePin({ pinId: ctx.params.pin, boardId: ctx.data.board_id || null })) throw forbidden();
  return { pin_id: String(ctx.params.pin), saved: true };
}
