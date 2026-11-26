import { nodeId } from '../util/ids.js';
import { getUser, getBoards, currentUserId, isSaved, isLiked, pinCounts, pinTags } from '../database/index.js';
import { scaledImages } from './images.js';
import { userShape } from './user.js';
import { boardShape } from './board.js';

export function pinShape(pin, { origin, withBoard = true } = {}) {
  if (!pin) return null;
  const pinner = userShape(getUser(pin.pinner_id) || getUser(currentUserId()), origin);
  const liked = isLiked(pin.id);
  const counts = pinCounts(pin.id);
  const boards = getBoards(currentUserId());
  return {
    node_id: nodeId('Pin', pin.id),
    id: String(pin.id),
    type: 'pin',
    title: pin.title,
    grid_title: pin.title,
    description: pin.description,
    auto_alt_text: pin.description,
    seo_alt_text: pin.description,
    link: pin.link || '',
    utm_link: pin.link || '',
    images: scaledImages(pin, origin),
    image_crop: { min_y: 0, max_y: 1 },
    dominant_color: pin.dominant_color,
    created_at: pin.created_at,
    is_promoted: false,
    is_eligible_for_pdp: true,
    is_eligible_for_filters: false,
    is_oos_product: false,
    is_prefetch_enabled: false,
    should_open_in_stream: false,
    link_utm_applicable_and_replaced: 1,
    repin_count: counts.saves,
    save_count: counts.saves,
    like_count: counts.likes,
    favorited_by_me: !!counts.favorited,
    favorite_user_count: counts.favorites,
    comment_count: counts.comments,
    total_reaction_count: counts.likes,
    reaction_counts: counts.likes ? { 1: counts.likes } : {},
    // The client reads reaction_by_me to show the filled heart after a reload.
    reaction_by_me: liked ? 1 : 0,
    viewer_reaction: liked ? 1 : null,
    pinner,
    board: withBoard && boards.length ? boardShape(boards[0], origin) : null,
    boards: boards.map((b) => boardShape(b, origin)),
    tags: pinTags(pin).map((tag) => ({ id: tag, name: String(tag).replaceAll('-', ' ') })),
    aggregated_pin_data: { node_id: nodeId('AggregatedPinData', pin.id) },
    pin_join: { visual_annotation: [] },
    shopping_flags: [],
    did_its: [],
    access: [],
    tracking_params: '',
    is_saved: isSaved(pin.id),
    is_liked: liked,
    attribution: { type: 'pinterest', source: 'local' },
    metadata: { pin_id: String(pin.id) },
  };
}

export const pinsShape = (pins, origin) => pins.map((pin) => pinShape(pin, { origin }));
