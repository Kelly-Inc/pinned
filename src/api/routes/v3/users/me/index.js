// The signed-in user with their editable settings; PUT/POST saves settings.
import { updateSettings } from '../../../../../database/index.js';
import { viewerShape } from '../../../../../schemas/index.js';

export const get = (ctx) => viewerShape(ctx.origin);

export function put(ctx) {
  updateSettings(ctx.data);
  return viewerShape(ctx.origin);
}
