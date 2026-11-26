// Request body readers with size limits.
import { payloadTooLarge } from './errors.js';
import { LIMITS } from '../config.js';

export function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(payloadTooLarge());
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readText(req, limit = LIMITS.jsonBytes) {
  return (await readBuffer(req, limit)).toString('utf8');
}

export async function readForm(req, limit = LIMITS.formBytes) {
  return new URLSearchParams(await readText(req, limit));
}
