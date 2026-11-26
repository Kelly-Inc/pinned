// One pin, as the closeup page and pin builder read it.
import { getPin } from '../../../../../database/index.js';
import { pinShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

export function get(ctx) {
  const pin = getPin(ctx.params.pin);
  if (!pin) throw notFound('Pin not found');
  return { ...pinShape(pin, { origin: ctx.origin }), board_title_suggestions: [] };
}
