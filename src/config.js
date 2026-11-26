// Central configuration. Everything tunable comes from the environment.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const env = process.env;

/** Where runtime data (database, uploads) lives. */
export const DATA_DIR = path.resolve(env.PINNED_DATA_DIR || path.join(ROOT, 'data'));
export const DB_PATH = path.resolve(env.PINNED_DB || env.PINTERESTD_DB || path.join(DATA_DIR, 'pinterestd.sqlite'));
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const UPLOAD_DIR = path.join(MEDIA_DIR, 'uploads');

/** Files that ship with the app. */
export const VENDOR_DIR = path.join(ROOT, 'vendor');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const SHELL_PATH = path.join(ROOT, 'data', 'pinterest_home.html');
export const SEED_PATH = path.join(ROOT, 'data', 'seed.json');

export const PORT = Number(env.PORT || 3000);
export const HOST = env.HOST || '0.0.0.0';
export const SEED_DEMO = env.PINNED_SEED === '1' || env.PINTERESTD_SEED === '1';
export const LOG_REQUESTS = env.PINNED_LOG_REQUESTS === '1';

export const SESSION_COOKIE = 'pinterestd_session';
export const SESSION_DAYS = 30;

export const LIMITS = {
  pinImageBytes: 20 * 1024 * 1024,
  avatarBytes: 10 * 1024 * 1024,
  formBytes: 100 * 1024,
  jsonBytes: 2 * 1024 * 1024,
  titleChars: 100,
  descriptionChars: 800,
  aboutChars: 500,
  profileFieldChars: 100,
  commentChars: 2000,
};
