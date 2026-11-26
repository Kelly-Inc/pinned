import { db, transaction } from '../connection.js';
import { currentUserId, maybeCurrentUserId } from '../context.js';
import { recordActivity } from './activity.js';
import { getUser } from './users.js';

export function followUser(followeeId) {
  const me = currentUserId();
  if (!getUser(followeeId) || String(followeeId) === me) return false;
  transaction(() => {
    const { changes } = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)')
      .run(me, String(followeeId));
    if (changes) recordActivity({ recipientId: String(followeeId), kind: 'follow' });
  });
  return true;
}

export function unfollowUser(followeeId) {
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(currentUserId(), String(followeeId));
  return true;
}

export function followCounts(userId) {
  const count = (column) => db.prepare(`SELECT COUNT(*) AS n FROM follows WHERE ${column} = ?`).get(String(userId)).n;
  return { followers: count('followee_id'), following: count('follower_id') };
}

export function isFollowing(followeeId) {
  const me = maybeCurrentUserId();
  if (!me) return false;
  return !!db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?').get(me, String(followeeId));
}

export function listFollowing(userId) {
  return db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.followee_id
    WHERE f.follower_id = ? ORDER BY f.created_at DESC`).all(String(userId));
}

export function listFollowers(userId) {
  return db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.followee_id = ? ORDER BY f.created_at DESC`).all(String(userId));
}
