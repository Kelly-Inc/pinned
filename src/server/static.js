// Static files: vendored client, uploads, avatars, public assets.
import fs from 'node:fs';
import path from 'node:path';
import { VENDOR_DIR, MEDIA_DIR, PUBLIC_DIR } from '../config.js';
import { MIME } from './mime.js';
import { vendorScript, unversion } from '../client/vendor.js';
import { initialAvatarSvg } from '../cdn/avatars.js';
import { getUser } from '../database/index.js';
import { sendText } from '../util/http.js';

/** Resolve a path inside root, refusing anything that escapes it. */
export function safeJoin(root, relative) {
  const target = path.resolve(root, `.${path.sep}${relative.replace(/^\/+/, '')}`);
  return target.startsWith(root + path.sep) ? target : null;
}

export function serveFile(res, file, { cache = 'public, max-age=86400' } = {}) {
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': cache,
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

const ROOT_FILES = { '/sw.js': 'sw.js', '/manifest.json': 'manifest.json', '/favicon.ico': 'favicon.ico' };

/** Serve a static file if the path is one. Returns true when handled. */
export function handleStatic(req, res, pathname) {
  if (pathname.startsWith('/webapp/')) {
    const file = safeJoin(VENDOR_DIR, unversion(pathname.slice('/webapp/'.length)));
    if (file && file.endsWith('.mjs') && fs.existsSync(file)) {
      const body = vendorScript(file);
      res.writeHead(200, {
        'content-type': MIME['.mjs'],
        'content-length': body.length,
        'cache-control': 'public, max-age=31536000, immutable',
      });
      res.end(body);
      return true;
    }
    if (file && serveFile(res, file)) return true;
  }

  const avatar = /^\/avatar\/([^/]+)\.svg$/.exec(pathname);
  if (avatar) {
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' });
    res.end(initialAvatarSvg(getUser(avatar[1])));
    return true;
  }

  if (pathname.startsWith('/media/')) {
    const rel = pathname.slice('/media/'.length);
    const file = safeJoin(MEDIA_DIR, rel) || safeJoin(PUBLIC_DIR, `media/${rel}`);
    if (file && serveFile(res, file)) return true;
    const fallback = safeJoin(PUBLIC_DIR, `media/${rel}`);
    if (fallback && serveFile(res, fallback)) return true;
  }

  if (pathname.startsWith('/assets/')) {
    const file = safeJoin(PUBLIC_DIR, pathname.slice('/assets/'.length));
    if (file && serveFile(res, file)) return true;
    // Never fall through to the app shell for asset URLs: the client's hidden
    // /assets/ct.html iframe would boot a second copy of the app.
    sendText(res, 'not found', 404);
    return true;
  }

  if (ROOT_FILES[pathname]) {
    if (serveFile(res, path.join(PUBLIC_DIR, ROOT_FILES[pathname]), { cache: 'no-cache' })) return true;
  }
  return false;
}
