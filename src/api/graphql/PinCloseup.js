// Pin closeup / detail queries.
import { getPin } from '../../database/index.js';
import { pinShape } from '../../schemas/index.js';

export const match = /Closeup|PinDetail/;
export const priority = 80;

export function resolve(ctx) {
  const pin = getPin(ctx.data.pinId || Object.values(ctx.data)[0]);
  return { pin: pin ? pinShape(pin, { origin: ctx.origin }) : null };
}
