// POST /upload/:id - the browser sends a registered pin image here.
import { ownUpload, completeUpload } from '../database/index.js';
import { readBuffer } from '../util/body.js';
import { multipartField } from '../util/multipart.js';
import { imageInfo } from '../util/images.js';
import { sendText } from '../util/http.js';
import { HttpError } from '../util/errors.js';
import { LIMITS } from '../config.js';
import { storeMedia } from './storage.js';

export async function receivePinImage(req, res, uploadId) {
  const upload = ownUpload(uploadId);
  if (!upload) return sendText(res, 'unknown upload', 404);
  if (upload.status === 'succeeded') return sendText(res, 'already uploaded', 409);
  let file;
  try {
    file = multipartField(await readBuffer(req, LIMITS.pinImageBytes + 1024 * 1024), req.headers['content-type'], 'file');
  } catch (error) {
    if (error instanceof HttpError) return sendText(res, error.message, error.status);
    throw error;
  }
  if (!file || !file.length || file.length > LIMITS.pinImageBytes) return sendText(res, 'missing or oversized file', 400);
  const info = imageInfo(file);
  if (!info) return sendText(res, 'unsupported image type', 415);
  const imagePath = storeMedia(`${upload.id}${info.ext}`, file);
  completeUpload(upload.id, { imagePath, width: info.width, height: info.height });
  res.writeHead(204, { 'cache-control': 'no-store' });
  return res.end();
}
