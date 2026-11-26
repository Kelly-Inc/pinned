// Profile photos: uploaded ones, and generated initial avatars for everyone else.
import { currentUserId, getUser, setAvatar, insertCompletedUpload } from '../database/index.js';
import { readBuffer } from '../util/body.js';
import { multipartField } from '../util/multipart.js';
import { imageInfo } from '../util/images.js';
import { sendJson } from '../util/http.js';
import { HttpError } from '../util/errors.js';
import { randomToken } from '../util/ids.js';
import { escapeHtml } from '../util/text.js';
import { LIMITS } from '../config.js';
import { storeMedia, deleteMedia } from './storage.js';

const COLORS = ['#e60023', '#0074e8', '#008753', '#8046a5', '#e3780c', '#b8005a', '#2b6f6f', '#5f6b7a'];

/** A colored circle with the user's initial; color is stable per user. */
export function initialAvatarSvg(user) {
  const name = String(user?.full_name || user?.username || '?').trim();
  const initial = escapeHtml([...name][0]?.toUpperCase() || '?');
  let hash = 0;
  for (const ch of String(user?.id || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = COLORS[hash % COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${color}"/><text x="50" y="67" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="bold" fill="#fff" text-anchor="middle">${initial}</text></svg>`;
}

/** POST /upload-profile-image/ (multipart field "img"). */
export async function receiveAvatar(req, res) {
  let file;
  try {
    file = multipartField(await readBuffer(req, LIMITS.avatarBytes + 1024 * 1024), req.headers['content-type'], 'img');
  } catch (error) {
    if (error instanceof HttpError) return sendJson(res, { error: error.message }, error.status);
    throw error;
  }
  if (!file || !file.length || file.length > LIMITS.avatarBytes) return sendJson(res, { error: 'missing or oversized image' }, 400);
  const info = imageInfo(file);
  if (!info) return sendJson(res, { error: 'unsupported image type' }, 415);
  const me = currentUserId();
  const previous = getUser(me)?.avatar;
  const imagePath = storeMedia(`avatar-${randomToken(12)}${info.ext}`, file);
  setAvatar(me, imagePath);
  const trackingId = insertCompletedUpload({ imagePath, width: info.width, height: info.height });
  if (previous?.startsWith('/media/uploads/avatar-')) deleteMedia(previous);
  return sendJson(res, { image_upload_tracking_id: trackingId });
}

export function removeAvatar() {
  const me = currentUserId();
  const previous = getUser(me)?.avatar;
  setAvatar(me, null);
  if (previous?.startsWith('/media/uploads/avatar-')) deleteMedia(previous);
}
