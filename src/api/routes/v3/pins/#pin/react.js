// Like (POST/PUT) or unlike (DELETE) a pin.
import { getPin, setLike } from '../../../../../database/index.js';
import { pinShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

function react(ctx, liked) {
  if (!setLike(ctx.params.pin, liked)) throw notFound('Pin not found');
  return pinShape(getPin(ctx.params.pin), { origin: ctx.origin });
}

export const post = (ctx) => react(ctx, true);
export const del = (ctx) => react(ctx, false);
