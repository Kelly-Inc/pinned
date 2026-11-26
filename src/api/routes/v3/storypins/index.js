// Publish from the pin builder. The image was uploaded beforehand; the story
// payload references it by signature (= our upload id).
import { ownUpload, createPin, ownBoard, savePin } from '../../../../database/index.js';
import { pinShape } from '../../../../schemas/index.js';
import { badRequest } from '../../../../util/errors.js';
import { parseJson, parseList } from '../../../../util/json.js';
import { clean } from '../../../../util/text.js';
import { LIMITS } from '../../../../config.js';

export function post(ctx) {
  const d = ctx.data;
  const story = parseJson(d.story_pin, {}) || {};
  const blocks = (story.pages || []).flatMap((page) => page.blocks || []);
  const signature = story.metadata?.pin_image_signature
    || blocks.find((b) => b.image_signature)?.image_signature
    || d.image_signature;
  const upload = ownUpload(signature);
  if (!upload || upload.status !== 'succeeded') throw badRequest('Image upload not found');

  const textBlocks = blocks.filter((b) => b.type === 0 && b.text).map((b) => b.text).join('\n');
  const pin = createPin({
    title: clean(d.title || story.metadata?.pin_title, LIMITS.titleChars),
    description: clean(d.description || textBlocks, LIMITS.descriptionChars),
    link: clean(d.link, 2048),
    imagePath: upload.image_path,
    width: upload.width,
    height: upload.height,
    tags: parseList(d.topic_tags).map(String),
  });
  const boardId = d.board_id || d.board;
  if (boardId && ownBoard(boardId)) savePin({ pinId: pin.id, boardId });

  const shaped = pinShape(pin, { origin: ctx.origin });
  return { ...shaped, image_signature: upload.id, image_square_url: shaped.images['236x'].url, story_pin_data_id: pin.id };
}
