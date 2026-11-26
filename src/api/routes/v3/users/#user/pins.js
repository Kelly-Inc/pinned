// A profile's Pins tab ("me" works too). The client sometimes POSTs this as a get.
import { resolveUser, profilePins } from '../../../../../database/index.js';
import { pinsShape } from '../../../../../schemas/index.js';

export const get = (ctx) => pinsShape(profilePins(resolveUser(ctx.params.user).id), ctx.origin);
