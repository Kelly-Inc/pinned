// Star or unstar a pin in the viewer's collection.
import { setFavorite } from '../../../../../database/index.js';
import { notFound } from '../../../../../util/errors.js';

function update(ctx, favorite) {
  if (!setFavorite(ctx.params.pin, favorite)) throw notFound('Saved pin not found');
  return {};
}

export const post = (ctx) => update(ctx, true);
export const del = (ctx) => update(ctx, false);
