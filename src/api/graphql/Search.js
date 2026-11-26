import { searchPins } from '../../database/index.js';
import { pinsShape } from '../../schemas/index.js';

export const match = /Search/;
export const priority = 50;

export const resolve = (ctx) => ({ search: { results: pinsShape(searchPins(ctx.data.query || ''), ctx.origin) } });
