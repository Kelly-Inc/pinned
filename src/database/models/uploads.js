import { db } from '../connection.js';
import { currentUserId } from '../context.js';
import { randomToken } from '../../util/ids.js';

export function registerUpload() {
  const id = randomToken(12);
  db.prepare('INSERT INTO uploads (id, user_id) VALUES (?, ?)').run(id, currentUserId());
  return id;
}

export function getUpload(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM uploads WHERE id = ?').get(String(id)) || null;
}

/** The upload if it belongs to the current user. */
export function ownUpload(id) {
  const upload = getUpload(id);
  return upload && upload.user_id === currentUserId() ? upload : null;
}

export function completeUpload(id, { imagePath, width, height }) {
  db.prepare("UPDATE uploads SET status = 'succeeded', image_path = ?, width = ?, height = ? WHERE id = ?")
    .run(imagePath, width, height, String(id));
}

/** Record an upload that finished in one step (avatars). */
export function insertCompletedUpload({ imagePath, width, height }) {
  const id = randomToken(12);
  db.prepare("INSERT INTO uploads (id, user_id, status, image_path, width, height) VALUES (?, ?, 'succeeded', ?, ?, ?)")
    .run(id, currentUserId(), imagePath, width, height);
  return id;
}

export function referencedMediaPaths() {
  const used = new Set();
  for (const sql of ['SELECT image_path AS p FROM pins', 'SELECT image_path AS p FROM uploads', 'SELECT avatar AS p FROM users']) {
    for (const row of db.prepare(sql).all()) if (row.p) used.add(row.p);
  }
  return used;
}
