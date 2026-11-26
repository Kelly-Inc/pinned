// Account settings: real profile columns plus a JSON bag for every other
// toggle the client's settings pages send.
import { currentUserId } from '../context.js';
import { badRequest } from '../../util/errors.js';
import { parseJson } from '../../util/json.js';
import { PRIVACY_DEFAULTS } from '../../schemas/privacy.js';
import { LIMITS } from '../../config.js';
import { getUser, getUserByUsername, setUsername, setAvatar, updateProfile, setSettingsJson } from './users.js';

const PROFILE_FIELDS = ['first_name', 'last_name', 'about', 'website_url'];
const NOT_STORED = new Set(['profile_image_url', ...PROFILE_FIELDS, 'username', 'surface_tag', 'full_name', 'id', 'options', 'context', 'data']);
export const USERNAME_RULE = /^[A-Za-z0-9_]{3,30}$/;

export function extraSettings(user) {
  return parseJson(user?.settings || '{}', {}) || {};
}

export function getSettings(userId = currentUserId()) {
  const user = getUser(userId);
  if (!user) return null;
  const extra = extraSettings(user);
  const [first, ...rest] = String(user.full_name || '').split(/\s+/);
  return {
    ...PRIVACY_DEFAULTS,
    ...extra,
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    first_name: user.first_name || first || '',
    last_name: user.last_name || rest.join(' '),
    about: user.about || '',
    website_url: user.website_url || '',
    email: extra.email || '',
    profile_image_url: user.avatar || null,
  };
}

/** Apply a settings update. Throws 400 on invalid input; returns the new settings. */
export function updateSettings(fields) {
  const id = currentUserId();
  const user = getUser(id);
  const current = getSettings(id);

  if (fields.username !== undefined && String(fields.username).trim() !== user.username) {
    const name = String(fields.username).trim();
    if (!USERNAME_RULE.test(name)) throw badRequest('Username must be 3-30 letters, numbers or underscores.');
    const taken = getUserByUsername(name);
    if (taken && taken.id !== id) throw badRequest('That username is taken.');
    setUsername(id, name);
  }

  const next = { ...current };
  for (const key of PROFILE_FIELDS) {
    if (fields[key] !== undefined) {
      const max = key === 'about' ? LIMITS.aboutChars : LIMITS.profileFieldChars;
      next[key] = String(fields[key] ?? '').slice(0, max).trim();
    }
  }
  updateProfile(id, {
    firstName: next.first_name,
    lastName: next.last_name,
    about: next.about,
    websiteUrl: next.website_url,
    fullName: `${next.first_name} ${next.last_name}`.trim() || user.username,
  });

  if (fields.profile_image_url === '' || fields.profile_image_url === null) setAvatar(id, null);

  const extra = extraSettings(user);
  for (const [key, value] of Object.entries(fields)) {
    if (NOT_STORED.has(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) extra[key] = value;
  }
  setSettingsJson(id, JSON.stringify(extra));
  return getSettings(id);
}

export function getSetting(key, fallback) {
  const value = extraSettings(getUser(currentUserId()))[key];
  return value === undefined ? fallback : value;
}

export function setSetting(key, value) {
  const id = currentUserId();
  const extra = extraSettings(getUser(id));
  extra[key] = value;
  setSettingsJson(id, JSON.stringify(extra));
}
