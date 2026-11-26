import { boardPins } from '../../../../../database/index.js';
import { pinsShape } from '../../../../../schemas/index.js';

export const get = (ctx) => pinsShape(boardPins(ctx.params.board), ctx.origin);
