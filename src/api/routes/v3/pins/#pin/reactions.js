// Who liked a pin.
import { db } from '../../../../../database/index.js';
import { userShape } from '../../../../../schemas/index.js';

export function get(ctx) {
  const users = db.prepare('SELECT u.* FROM likes l JOIN users u ON u.id = l.user_id WHERE l.pin_id = ?').all(String(ctx.params.pin));
  return users.map((u) => ({ reaction_type: 1, user: userShape(u, ctx.origin) }));
}
