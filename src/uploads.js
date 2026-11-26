import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, currentUserId } from './db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPLOAD_DIR = path.join(ROOT, 'data', 'media', 'uploads');
const MAX_BYTES = 20 * 1024 * 1024;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS uploads (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'registered',
    image_path  TEXT,
    width       INTEGER,
    height      INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function registerUpload() {
  const id = crypto.randomBytes(12).toString('hex');
  db.prepare('INSERT INTO uploads (id, user_id) VALUES (?, ?)').run(id, currentUserId());
  return id;
}

export function registration(id, origin) {
  return {
    upload_id: id,
    upload_url: `${origin}/upload/${id}`,
    upload_parameters: { key: `uploads/${id}` },
  };
}

export function getUpload(id) {
  return db.prepare('SELECT * FROM uploads WHERE id = ?').get(String(id || '')) || null;
}

export function uploadStatus(ids) {
  const out = {};
  for (const id of ids || []) {
    const u = getUpload(id);
    if (!u || u.user_id !== currentUserId()) continue;
    out[id] = { status: u.status === 'succeeded' ? 'succeeded' : 'registered', signature: u.status === 'succeeded' ? u.id : '' };
  }
  return out;
}

function imageSize(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { ext: '.png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { ext: '.gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WEBP
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { ext: '.webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { ext: '.webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { ext: '.webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { ext: '.jpg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BYTES + 1024 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function multipartFile(body, contentType, field = 'file') {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!boundary) return body; // raw body upload
  const delim = Buffer.from(`--${boundary[1] || boundary[2]}`);
  let pos = body.indexOf(delim);
  while (pos !== -1) {
    const next = body.indexOf(delim, pos + delim.length);
    if (next === -1) break;
    const part = body.subarray(pos + delim.length + 2, next - 2);
    const headEnd = part.indexOf('\r\n\r\n');
    if (headEnd !== -1) {
      const head = part.subarray(0, headEnd).toString('utf8');
      if (new RegExp(`name="${field}"`, 'i').test(head)) return part.subarray(headEnd + 4);
    }
    pos = next;
  }
  return null;
}

/** POST /upload/:id — receives the browser's multipart file post. */
export async function receiveUpload(req, res, id) {
  const send = (status, msg) => {
    res.writeHead(status, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    res.end(msg);
  };
  const upload = getUpload(id);
  if (!upload || upload.user_id !== currentUserId()) return send(404, 'unknown upload');
  if (upload.status === 'succeeded') return send(409, 'already uploaded');
  let file;
  try { file = multipartFile(await readBody(req), req.headers['content-type']); } catch { return send(413, 'too large'); }
  if (!file || !file.length || file.length > MAX_BYTES) return send(400, 'missing or oversized file');
  const info = imageSize(file);
  if (!info || !info.width || !info.height) return send(415, 'unsupported image type');
  const name = `${upload.id}${info.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file);
  db.prepare("UPDATE uploads SET status = 'succeeded', image_path = ?, width = ?, height = ? WHERE id = ?")
    .run(`/media/uploads/${name}`, info.width, info.height, upload.id);
  return send(204, '');
}

/** POST /upload-profile-image/ — the client's profile photo upload (field "img"). */
export async function receiveAvatar(req, res) {
  const send = (status, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
  };
  let file;
  try { file = multipartFile(await readBody(req), req.headers['content-type'], 'img'); } catch { return send(413, { error: 'too large' }); }
  if (!file || !file.length || file.length > 10 * 1024 * 1024) return send(400, { error: 'missing or oversized image' });
  const info = imageSize(file);
  if (!info) return send(415, { error: 'unsupported image type' });
  const id = crypto.randomBytes(12).toString('hex');
  const name = `avatar-${id}${info.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file);
  const me = currentUserId();
  const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(me)?.avatar;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(`/media/uploads/${name}`, me);
  db.prepare("INSERT INTO uploads (id, user_id, status, image_path, width, height) VALUES (?, ?, 'succeeded', ?, ?, ?)")
    .run(id, me, `/media/uploads/${name}`, info.width, info.height);
  if (old && old.startsWith('/media/uploads/avatar-')) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(old))); } catch {}
  }
  return send(200, { image_upload_tracking_id: id });
}

/** Status codes the client polls for: 4 = done, 5 = failed. */
export function imageUploadStatus(ids) {
  const out = {};
  for (const id of ids) {
    const u = getUpload(id);
    out[id] = u && u.user_id === currentUserId() && u.status === 'succeeded' ? 4 : 5;
  }
  return out;
}

export function removeAvatar() {
  const me = currentUserId();
  const old = db.prepare('SELECT avatar FROM users WHERE id = ?').get(me)?.avatar;
  db.prepare('UPDATE users SET avatar = NULL WHERE id = ?').run(me);
  if (old && old.startsWith('/media/uploads/avatar-')) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(old))); } catch {}
  }
}
