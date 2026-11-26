// "More like this" under a pin: other pins sharing a tag or word with it,
// newest first. Never includes the pin itself.
import { getPin, searchPins, pinTags } from '../../database/index.js';
import { pinsShape } from '../../schemas/index.js';

export function get(ctx) {
  const pin = getPin(ctx.options.pin || ctx.options.pin_id || ctx.options.id);
  if (!pin) return [];
  const words = [...pinTags(pin), ...`${pin.title} ${pin.description}`.split(/\W+/)]
    .map((w) => String(w).toLowerCase()).filter((w) => w.length > 3);
  if (!words.length) return [];
  return pinsShape(searchPins([...new Set(words)].slice(0, 12).join(' '), 50).filter((p) => p.id !== pin.id), ctx.origin);
}
