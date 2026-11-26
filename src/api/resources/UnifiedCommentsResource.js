// The comment list under a pin.
import { listComments } from '../../database/index.js';
import { commentShape } from '../../schemas/index.js';

export const aliases = ['UnifiedCommentsPreviewResource'];

export function get(ctx) {
  const pinId = ctx.options.pin_id || ctx.options.id || ctx.options.objectId;
  const results = listComments(pinId).map((c) => commentShape(c, ctx.origin));
  return { results, comment_count: results.length };
}
