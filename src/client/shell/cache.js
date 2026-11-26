// Built shells are cached per user and invalidated when what they show changes.
import { buildShell } from './build.js';
import { BUILD } from '../vendor.js';

const cache = new Map();

export function shellFor(origin, user) {
  const key = [origin, user.id, user.username, user.full_name, user.avatar || ''].join('|');
  let html = cache.get(key);
  if (!html) {
    html = buildShell({ origin, user, build: BUILD });
    if (cache.size > 500) cache.clear();
    cache.set(key, html);
  }
  return html;
}
