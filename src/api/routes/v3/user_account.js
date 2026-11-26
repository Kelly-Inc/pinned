// The signed-in account.
import { viewerShape } from '../../../schemas/index.js';

export const get = (ctx) => viewerShape(ctx.origin);
