// /login, /signup and /logout.
import { createSession, deleteSession, userForSession } from '../database/index.js';
import { getCookie, serializeCookie } from '../util/cookies.js';
import { readForm } from '../util/body.js';
import { sendHtml, redirect } from '../util/http.js';
import { SESSION_COOKIE, SESSION_DAYS } from '../config.js';
import { signUp, logIn } from './accounts.js';
import { authPage } from './page.js';

const sessionCookie = (token, maxAge) => serializeCookie(SESSION_COOKIE, token, { maxAge });

export function sessionUser(req) {
  return userForSession(getCookie(req, SESSION_COOKIE));
}

/** Handles the request if it is an auth route. Returns true when handled. */
export async function handleAuth(req, res, pathname) {
  const route = pathname.replace(/\/+$/, '') || '/';

  if (route === '/logout') {
    deleteSession(getCookie(req, SESSION_COOKIE));
    redirect(res, '/login', 303, { 'set-cookie': sessionCookie('', 0) });
    return true;
  }
  if (route !== '/login' && route !== '/signup') return false;
  const mode = route.slice(1);

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (sessionUser(req)) redirect(res, '/');
    else sendHtml(res, authPage({ mode }));
    return true;
  }
  if (req.method !== 'POST') return false;

  const form = await readForm(req);
  const username = form.get('username') || '';
  const password = form.get('password') || '';
  let user;
  if (mode === 'signup') {
    const result = signUp({ username, fullName: form.get('full_name'), password });
    if (result.error) {
      sendHtml(res, authPage({ mode, error: result.error, username }), 400);
      return true;
    }
    user = result.user;
  } else {
    user = logIn(username, password);
    if (!user) {
      sendHtml(res, authPage({ mode, error: 'Wrong username or password.', username }), 401);
      return true;
    }
  }
  redirect(res, '/', 303, { 'set-cookie': sessionCookie(createSession(user.id), 60 * 60 * 24 * SESSION_DAYS) });
  return true;
}
