import { getUser } from '../database/index.js';
import { userShape } from './user.js';

export function commentShape(comment, origin) {
  if (!comment) return null;
  return {
    id: String(comment.id),
    type: 'aggregatedcomment',
    text: comment.text,
    created_at: comment.created_at,
    pin_id: String(comment.pin_id),
    user: userShape(getUser(comment.user_id), origin),
  };
}
