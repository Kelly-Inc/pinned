// Optional demo content (PINNED_SEED=1) from data/seed.json, attached to the
// first registered account.
import fs from 'node:fs';
import { db, transaction } from './connection.js';
import { currentUserId } from './context.js';
import { countPins } from './models/pins.js';
import { SEED_PATH } from '../config.js';

export function seedDatabase({ force = false } = {}) {
  if (countPins() > 0 && !force) return { inserted: 0, skipped: true };
  if (!fs.existsSync(SEED_PATH)) return { inserted: 0, skipped: true, reason: 'missing seed file' };
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const owner = currentUserId();
  const insertUser = db.prepare('INSERT INTO users (id, username, full_name, avatar) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  const insertPin = db.prepare(`
    INSERT INTO pins (id, title, description, link, image_path, width, height, dominant_color, pinner_id, created_at, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
  `);
  const insertBoard = db.prepare('INSERT INTO boards (id, user_id, name, description) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING');
  let inserted = 0;
  transaction(() => {
    for (const u of seed.pinners || []) insertUser.run(u.id, u.username, u.full_name, u.avatar || null);
    for (const p of seed.pins || []) {
      insertPin.run(String(p.id), p.title || '', p.description || '', p.link || '', p.image_path || '',
        p.width || 600, p.height || 900, p.dominant_color || '#efefef', String(p.pinner_id || owner),
        p.created_at || '2024-01-01 00:00:00', JSON.stringify(p.tags || []));
      inserted += 1;
    }
    for (const b of seed.boards || []) insertBoard.run(String(b.id), owner, b.name, b.description || '');
  });
  return { inserted, skipped: false };
}
