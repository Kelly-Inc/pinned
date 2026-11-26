// Profile Pins tab filters are combined when both chips are selected.
import { resolveUser, profilePins } from '../../../../../../database/index.js';
import { pinsShape } from '../../../../../../schemas/index.js';

export function get(ctx) {
  const filters = String(ctx.data.flag_filters || '').split(',');
  const pins = profilePins(resolveUser(ctx.params.user).id, 500, filters);
  return pinsShape(pins, ctx.origin);
}
