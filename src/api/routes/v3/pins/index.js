// The newest pins.
import { listPins } from '../../../../database/index.js';
import { pinsShape } from '../../../../schemas/index.js';

export const get = (ctx) => pinsShape(listPins({ limit: 100 }), ctx.origin);
