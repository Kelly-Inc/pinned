// One pin: read, create (simple), edit, delete.
import { getPin, createPin, updatePin, deletePin, unsavePin, ownBoard, savePin } from '../../database/index.js';
import { pinShape } from '../../schemas/index.js';
import { forbidden } from '../../util/errors.js';
import { clean } from '../../util/text.js';
import { LIMITS } from '../../config.js';

export const aliases = ['PinPageResource', 'PinInfoResource'];

const pinId = (data) => data.id || data.pin_id || data.pinId;

export function get(ctx) {
  return pinShape(getPin(pinId(ctx.options)), { origin: ctx.origin });
}

export function create(ctx) {
  const d = ctx.data;
  const pin = createPin({
    title: clean(d.title, LIMITS.titleChars),
    description: clean(d.description, LIMITS.descriptionChars),
    link: clean(d.link, 2048),
    imagePath: String(d.image_path || d.image_url || ''),
    tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
  });
  if (d.board_id && ownBoard(d.board_id)) savePin({ pinId: pin.id, boardId: d.board_id });
  return pinShape(pin, { origin: ctx.origin });
}

export function update(ctx) {
  const pin = updatePin(pinId(ctx.data), ctx.data);
  if (!pin) throw forbidden();
  return pinShape(pin, { origin: ctx.origin });
}

// Deleting your own pin removes it; "deleting" someone else's removes your save.
export function remove(ctx) {
  const id = pinId(ctx.data);
  if (!deletePin(id)) unsavePin(id);
  return null;
}
