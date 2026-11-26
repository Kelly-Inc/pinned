// The home feed: newest pins across the instance, paginated by offset.
import { listPins } from '../../database/index.js';
import { pinsShape } from '../../schemas/index.js';

export const aliases = ['HomefeedStreamResource', 'BestPinsFeedAltResource', 'StoryFeedResource'];

export function get(ctx) {
  const offset = ctx.bookmark ? Math.max(0, parseInt(String(ctx.bookmark), 10) || 0) : 0;
  const limit = Math.min(Number(ctx.options.page_size) || 60, 250);
  const pins = pinsShape(listPins({ limit, offset }), ctx.origin);
  ctx.meta.auxData = { feed_type: 'homefeed', count: pins.length };
  if (pins.length === limit) ctx.meta.bookmark = String(offset + limit);
  return pins;
}
