// Notifications are private to their recipient.
import { db, transaction } from '../connection.js';
import { currentUserId } from '../context.js';
import { getUser } from './users.js';
import { extraSettings } from './settings.js';
import { ACTIVITY_PREFERENCES, prefKey } from '../../schemas/notifications.js';
import { parseJson } from '../../util/json.js';

export function recordActivity({ recipientId, kind, pinId = null, commentId = null }) {
  const actorId = currentUserId();
  if (recipientId === actorId) return;
  const [category, subcategory] = ACTIVITY_PREFERENCES[kind];
  const prefs = parseJson(extraSettings(getUser(recipientId)).notification_prefs, {});
  if (prefs?.[prefKey(category, subcategory, 'news')] === false) return;
  db.prepare(`
    INSERT INTO activity_notifications (recipient_id, actor_id, kind, pin_id, comment_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(recipientId, actorId, kind, pinId, commentId);
}

export function listActivity(limit) {
  return db.prepare(`
    SELECT n.*, u.username, u.full_name
    FROM activity_notifications n JOIN users u ON u.id = n.actor_id
    WHERE recipient_id = ? AND hidden = 0
    ORDER BY n.id DESC LIMIT ?
  `).all(currentUserId(), limit);
}

export function unreadActivityCount() {
  return db.prepare(`
    SELECT count(*) AS count FROM activity_notifications
    WHERE recipient_id = ? AND hidden = 0 AND unread = 1
  `).get(currentUserId()).count;
}

export function clearActivityBadge() {
  db.prepare('UPDATE activity_notifications SET unread = 0 WHERE recipient_id = ? AND unread = 1').run(currentUserId());
}

export function hideActivity(ids, shouldHide) {
  const update = db.prepare('UPDATE activity_notifications SET hidden = ? WHERE recipient_id = ? AND id = ?');
  transaction(() => {
    for (const id of ids) update.run(Number(shouldHide), currentUserId(), id);
  });
}
