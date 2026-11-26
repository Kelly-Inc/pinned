// Upload status polling: { [uploadId]: { status, signature } }.
import { ownUpload } from '../../../../../database/index.js';
import { parseList } from '../../../../../util/json.js';

export function get(ctx) {
  const out = {};
  for (const id of parseList(ctx.data.upload_ids)) {
    const upload = ownUpload(id);
    if (!upload) continue;
    const done = upload.status === 'succeeded';
    out[id] = { status: done ? 'succeeded' : 'registered', signature: done ? upload.id : '' };
  }
  return out;
}
