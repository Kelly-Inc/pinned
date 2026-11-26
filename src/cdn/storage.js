// Files under data/media/uploads.
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '../config.js';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Write bytes and return the public path (/media/uploads/<name>). */
export function storeMedia(name, buffer) {
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `/media/uploads/${name}`;
}

/** Delete a previously stored file by its public path. Ignores anything else. */
export function deleteMedia(publicPath) {
  if (!publicPath || !publicPath.startsWith('/media/uploads/')) return;
  try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(publicPath))); } catch {}
}
