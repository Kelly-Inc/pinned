// Sign up and log in.
import { createUser, getUserByUsername, USERNAME_RULE } from '../database/index.js';
import { hashPassword, verifyPassword } from './passwords.js';

export const MIN_PASSWORD = 8;

/** Returns { user } or { error }. */
export function signUp({ username, fullName, password }) {
  const name = String(username || '').trim();
  if (!USERNAME_RULE.test(name)) return { error: 'Username must be 3-30 letters, numbers or underscores.' };
  if (String(password || '').length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (getUserByUsername(name)) return { error: 'That username is taken.' };
  const user = createUser({
    username: name,
    fullName: String(fullName || '').trim() || name,
    passwordHash: hashPassword(String(password)),
  });
  return { user };
}

/** The user for valid credentials, otherwise null. */
export function logIn(username, password) {
  const user = getUserByUsername(String(username || '').trim());
  if (!user || !user.password_hash) return null;
  return verifyPassword(String(password || ''), user.password_hash) ? user : null;
}
