import crypto from 'node:crypto';

/** Time-ordered numeric string id, like Pinterest's. */
export function newId() {
  return `${Date.now()}${crypto.randomInt(1000, 10000)}`;
}

/** Random hex token. */
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Pinterest node ids are base64("Type:id"). */
export function nodeId(type, id) {
  return Buffer.from(`${type}:${id}`).toString('base64');
}
