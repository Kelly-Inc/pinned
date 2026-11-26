// The request pipeline:
//   static files -> redirects -> auth pages -> session -> uploads -> API -> app shell
import { handleStatic } from './static.js';
import { handleAuth, sessionUser } from '../auth/routes.js';
import { handleApi, isApiPath } from '../api/index.js';
import { receivePinImage } from '../cdn/pinImages.js';
import { receiveAvatar } from '../cdn/avatars.js';
import { shellFor } from '../client/shell/cache.js';
import { extraSettings, getUserByUsername, runAs, searchPrivacyEnabled } from '../database/index.js';
import { sendHtml, sendJson, redirect } from '../util/http.js';
import { log } from '../util/logger.js';
import { PORT, LOG_REQUESTS } from '../config.js';

async function route(req, res, url, pathname) {
  if (handleStatic(req, res, pathname)) return;

  // The client drops `q` when it handles /search/ itself; keep the query.
  if (pathname === '/search' || pathname === '/search/') {
    return redirect(res, `/search/pins/${url.search}`, 302);
  }

  if (await handleAuth(req, res, pathname)) return;

  // Profile and board URLs both start with the owner's username.
  const profilePath = /^\/([a-z0-9_]{3,30})(?:\/[^/]+)?\/?$/i.exec(pathname);
  if (profilePath && !isApiPath(pathname)) {
    const owner = getUserByUsername(profilePath[1]);
    if (owner && searchPrivacyEnabled(extraSettings(owner))) res.setHeader('X-Robots-Tag', 'noindex');
  }

  const user = sessionUser(req);
  if (!user) {
    if (isApiPath(pathname)) return sendJson(res, { error: 'not authenticated' }, 401);
    return redirect(res, '/login');
  }

  return runAs(user.id, async () => {
    if (req.method === 'POST' && /^\/upload-profile-image\/?$/.test(pathname)) return receiveAvatar(req, res);
    const upload = /^\/upload\/([a-f0-9]+)\/?$/.exec(pathname);
    if (req.method === 'POST' && upload) return receivePinImage(req, res, upload[1]);
    if (isApiPath(pathname)) return handleApi(req, res, url);
    // Everything else is a client-side route: serve the app shell.
    return sendHtml(res, shellFor(url.origin, user));
  });
}

export async function handleRequest(req, res) {
  const started = Date.now();
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(res, { error: 'bad path' }, 400);
  }
  try {
    await route(req, res, url, pathname);
  } catch (error) {
    log.error('request failed:', req.method, pathname, error);
    if (!res.headersSent) sendJson(res, { error: 'Internal error' }, 500);
    else res.end();
  } finally {
    if (LOG_REQUESTS) res.once('finish', () => log.info(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`));
  }
}
