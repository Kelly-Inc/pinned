// Avatar upload status: 4 = done, 5 = failed.
import { ownUpload } from '../../../../../database/index.js';
import { parseList } from '../../../../../util/json.js';

export function get(ctx) {
  const out = {};
  for (const id of parseList(ctx.data.tracking_id).map(String)) {
    out[id] = ownUpload(id)?.status === 'succeeded' ? 4 : 5;
  }
  return out;
}
