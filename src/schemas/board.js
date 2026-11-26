import { nodeId } from '../util/ids.js';
import { slugify } from '../util/text.js';
import { getUser, getPin, boardPinCount, boardPreviewPins, currentUserId } from '../database/index.js';
import { userShape } from './user.js';

export function boardShape(board, origin) {
  if (!board) return null;
  const owner = userShape(getUser(board.user_id) || getUser(currentUserId()), origin);
  const preview = boardPreviewPins(board.id, 4);
  const cover = (board.cover_pin_id && getPin(board.cover_pin_id)) || preview[0] || null;
  const coverUrl = cover ? `${origin}${cover.image_path}` : `${origin}/media/avatar.svg`;
  const coverSize = (width) => ({
    url: coverUrl,
    width,
    height: cover ? Math.round((cover.height / cover.width) * width) : width,
  });
  return {
    node_id: nodeId('Board', board.id),
    id: String(board.id),
    type: 'board',
    name: board.name,
    description: board.description || '',
    url: `/${owner?.username || 'me'}/${slugify(board.name)}/`,
    privacy: board.is_secret ? 'secret' : 'public',
    is_secret: !!board.is_secret,
    pin_count: boardPinCount(board.id),
    collaborator_count: 0,
    collaborating_users: [],
    is_collaborative: false,
    owner,
    image_cover_url: coverUrl,
    image_cover_hd_url: coverUrl,
    cover_images: { '236x': coverSize(236), '474x': coverSize(474), orig: coverSize(cover?.width || 474) },
    pin_thumbnail_urls: preview.map((pin) => `${origin}${pin.image_path}`),
    images: { '236x': preview.map((pin) => ({ url: `${origin}${pin.image_path}` })) },
    section_count: 0,
    created_at: board.created_at,
  };
}
