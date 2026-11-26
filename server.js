import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHtml } from './src/patcher.js';
import { handleApi } from './src/api.js';
import {
  seedDatabase, countPins, db, requestUser, createAccount, authenticate,
  createSession, userForSession, deleteSession, getUser, purgeExpiredSessions,
} from './src/db.js';
import { authPage } from './src/auth_page.js';
import { receiveUpload, receiveAvatar } from './src/uploads.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(ROOT, 'vendor');
const MEDIA = path.join(ROOT, 'data', 'media');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// A fresh self-hosted instance starts empty. Seeding is opt-in for demos only
// and attaches seeded content to the first registered account.
const firstUser = db.prepare('SELECT id FROM users WHERE password_hash IS NOT NULL ORDER BY created_at LIMIT 1').get();
if (process.env.PINTERESTD_SEED === '1' && countPins() === 0 && firstUser) {
  const result = requestUser.run(firstUser.id, () => seedDatabase());
  console.log(`Seeded ${result.inserted} pins from data/seed.json`);
}

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000).unref();

const AVATAR_COLORS = ['#e60023', '#0074e8', '#008753', '#8046a5', '#e3780c', '#b8005a', '#2b6f6f', '#5f6b7a'];
function avatarSvg(user) {
  const name = (user?.full_name || user?.username || '?').trim();
  const initial = esc([...name][0]?.toUpperCase() || '?');
  let h = 0;
  for (const ch of String(user?.id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${color}"/><text x="50" y="67" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="bold" fill="#fff" text-anchor="middle">${initial}</text></svg>`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const SESSION_COOKIE = 'pinterestd_session';

function getCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e5) { reject(new Error('form too large')); req.destroy(); }
    });
    req.on('end', () => resolve(new URLSearchParams(body)));
  });
}

function sendHtml(res, body, status = 200, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { location, 'cache-control': 'no-store', ...headers });
  res.end();
}

function sessionCookie(token, maxAge) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// Returns true when the request was an auth page/action and has been answered.
async function handleAuth(req, res, pathname) {
  const route = pathname.replace(/\/+$/, '') || '/';
  if (route === '/logout') {
    deleteSession(getCookie(req, SESSION_COOKIE));
    redirect(res, '/login', { 'set-cookie': sessionCookie('', 0) });
    return true;
  }
  if (route !== '/login' && route !== '/signup') return false;
  const mode = route.slice(1);
  if (req.method === 'GET') {
    if (userForSession(getCookie(req, SESSION_COOKIE))) redirect(res, '/');
    else sendHtml(res, authPage({ mode }));
    return true;
  }
  if (req.method !== 'POST') return false;
  const form = await readForm(req);
  const username = form.get('username') || '';
  let user;
  if (mode === 'signup') {
    const result = createAccount({
      username, fullName: form.get('full_name'), password: form.get('password') || '',
    });
    if (result.error) {
      sendHtml(res, authPage({ mode, error: result.error, username }), 400);
      return true;
    }
    user = result.user;
  } else {
    user = authenticate(username, form.get('password') || '');
    if (!user) {
      sendHtml(res, authPage({ mode, error: 'Wrong username or password.', username }), 401);
      return true;
    }
  }
  redirect(res, '/', { 'set-cookie': sessionCookie(createSession(user.id), 60 * 60 * 24 * 30) });
  return true;
}

const MIME = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function safeFile(root, relative) {
  const target = path.resolve(root, '.' + path.sep + relative.replace(/^\/+/, ''));
  if (!target.startsWith(root + path.sep)) return null;
  return target;
}

function serveFile(res, file, { cache = 'public, max-age=86400' } = {}) {
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': cache,
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

// The vendored client hardcodes pinterest.com for its own in-app links
// (e.g. the gear menu's "Settings" -> https://www.pinterest.com/settings).
// Keep app routes on this server; help/policy/business pages stay external.
const APP_ROUTES = 'settings|pin|homefeed|search|engagement|edit|attribution_source|username|ideas|today|notifications|inbox|pin-creation-tool|pin-builder|business/hub';
const BUILD = `_v${Date.now().toString(36)}`; // busts browser caches on every restart
const vendorCache = new Map();
function rewriteVendor(code) {
  return code
    .replace(new RegExp(`https://(?:www\\.)?pinterest\\.com(?=/(?:${APP_ROUTES})(?:[/?#"'\`]|$))`, 'g'), '')
    .replaceAll('"https://www.pinterest.com"', '(typeof location!=="undefined"?location.origin:"")')
    .replace('.p="/webapp/"', `.p="/webapp/${BUILD}/"`);
}
function serveVendorScript(res, file) {
  let body = vendorCache.get(file);
  if (!body) {
    try { body = Buffer.from(rewriteVendor(fs.readFileSync(file, 'utf8'))); } catch { return false; }
    vendorCache.set(file, body);
  }
  res.writeHead(200, {
    'content-type': MIME['.mjs'],
    'content-length': body.length,
    'cache-control': 'public, max-age=31536000, immutable',
  });
  res.end(body);
  return true;
}

const htmlCache = new Map();
function htmlForUser(origin, user) {
  const key = `${origin}|${user.id}|${user.username}|${user.full_name}|${user.avatar || ''}`;
  if (!htmlCache.has(key)) {
    htmlCache.set(key, buildHtml({ origin, user, build: BUILD }));
  }
  return htmlCache.get(key);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const origin = url.origin;
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/webapp/')) {
      const file = safeFile(VENDOR, pathname.slice('/webapp/'.length).replace(/^_v[a-z0-9]+\//, ''));
      if (file && file.endsWith('.mjs') && serveVendorScript(res, file)) return;
      if (file && serveFile(res, file)) return;
    }
    const avatarMatch = pathname.match(/^\/avatar\/([^/]+)\.svg$/);
    if (avatarMatch) {
      const body = avatarSvg(getUser(avatarMatch[1]));
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' });
      return res.end(body);
    }
    if (pathname.startsWith('/media/')) {
      const rel = pathname.slice('/media/'.length);
      const file = safeFile(MEDIA, rel) || safeFile(PUBLIC, 'media/' + rel);
      if (file && serveFile(res, file)) return;
    }
    if (pathname.startsWith('/assets/')) {
      const file = safeFile(PUBLIC, pathname.slice('/assets/'.length));
      if (file && serveFile(res, file)) return;
      // Never fall through to the SPA shell for asset URLs (e.g. the client's
      // hidden /assets/ct.html iframe), which would boot a second app copy.
      res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      return res.end('not found');
    }

    const rootFiles = {
      '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'],
      '/manifest.json': ['manifest.json', 'application/manifest+json'],
      '/favicon.ico': ['favicon.ico', 'image/x-icon'],
    };
    if (rootFiles[pathname]) {
      const [file] = rootFiles[pathname];
      if (serveFile(res, path.join(PUBLIC, file), { cache: 'no-cache' })) return;
    }

    // The official client drops `q` when it handles /search/ client-side.
    // Redirect before the shell loads so the query survives.
    if (pathname === '/search' || pathname === '/search/') {
      res.writeHead(302, {
        location: `/search/pins/${url.search}`,
        'cache-control': 'no-store',
      });
      return res.end();
    }

    if (await handleAuth(req, res, pathname)) return;

    const user = userForSession(getCookie(req, SESSION_COOKIE));
    const isApi = pathname.startsWith('/resource/') || pathname.startsWith('/v3/') ||
      pathname.startsWith('/_/') || pathname.startsWith('/api/') ||
      pathname.startsWith('/refresh');
    if (!user) {
      if (isApi) {
        res.writeHead(401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        return res.end(JSON.stringify({ error: 'not authenticated' }));
      }
      return redirect(res, '/login');
    }
    if (/^\/upload-profile-image\/?$/.test(pathname) && req.method === 'POST') {
      htmlCache.clear();
      return await requestUser.run(user.id, () => receiveAvatar(req, res));
    }
    const uploadMatch = pathname.match(/^\/upload\/([a-f0-9]+)\/?$/);
    if (uploadMatch && req.method === 'POST') {
      return await requestUser.run(user.id, () => receiveUpload(req, res, uploadMatch[1]));
    }
    if (isApi) return await requestUser.run(user.id, () => handleApi(req, res, url));

    // Everything else is the official client shell (SPA routing).
    sendHtml(res, htmlForUser(origin, user));
  } catch (error) {
    console.error('request failed:', pathname, error);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`pinterestd running at http://localhost:${PORT}`);
  console.log(`  ${countPins()} pins in ${path.join(ROOT, 'data', 'pinterestd.sqlite')}`);
});
