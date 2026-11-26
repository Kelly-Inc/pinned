// Reserve several upload slots, keyed by the client's own ids.
import { registerUpload } from '../../../../../../database/index.js';
import { uploadRegistration } from '../../../../../../schemas/index.js';
import { parseList } from '../../../../../../util/json.js';

export function post(ctx) {
  const out = {};
  for (const item of parseList(ctx.data.media_info_list)) {
    if (item && item.id) out[item.id] = uploadRegistration(registerUpload(), ctx.origin);
  }
  return out;
}
