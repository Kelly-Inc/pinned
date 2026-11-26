// Search results for pins or (your) boards.
import { searchPins, getBoards } from '../../database/index.js';
import { pinsShape, boardShape } from '../../schemas/index.js';

export const aliases = ['SearchResource'];

export function get(ctx) {
  const scope = ctx.options.scope || 'pins';
  const query = String(ctx.options.query || '');
  const base = { query, scope, oneBarModules: [], rankedGuides: [] };
  if (scope === 'boards') {
    const needle = query.toLowerCase();
    const results = getBoards()
      .filter((b) => `${b.name} ${b.description}`.toLowerCase().includes(needle))
      .map((b) => boardShape(b, ctx.origin));
    return { ...base, results };
  }
  const limit = Math.min(Number(ctx.options.page_size) || 100, 250);
  return {
    ...base,
    results: pinsShape(searchPins(query, limit), ctx.origin),
    shouldAppendGlobalSearch: false,
    sensitivity: 'none',
    queryL1VerticalIds: [],
    clientTrackingParams: {},
  };
}
