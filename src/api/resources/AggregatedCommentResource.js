// Comments on pins.
import { addComment, deleteComment } from '../../database/index.js';
import { commentShape } from '../../schemas/index.js';
import { badRequest, forbidden } from '../../util/errors.js';

export function create(ctx) {
  const comment = addComment(ctx.data.pinId || ctx.data.objectId || ctx.data.pin_id, ctx.data.text);
  if (!comment) throw badRequest('Empty comment');
  return commentShape(comment, ctx.origin);
}

export function remove(ctx) {
  if (!deleteComment(ctx.data.commentId || ctx.data.id)) throw forbidden();
  return null;
}
