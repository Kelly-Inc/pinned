import {
  db, currentUserId, pinCounts, followCounts, isFollowing, isSaved, isLiked, getBoards, getUser, getPin, slugifyBoardName,
} from './db.js';

function nodeId(prefix, id) {
  return Buffer.from(`${prefix}:${id}`).toString('base64');
}

function scaledImages(pin, origin) {
  const url = `${origin}${pin.image_path}`;
  const { width, height } = pin;
  const make = (w) => {
    const h = Math.round((height / width) * w);
    return { url, width: w, height: h };
  };
  return {
    '170x': make(170),
    '236x': make(236),
    '474x': make(474),
    '736x': make(736),
    orig: { url, width, height },
  };
}

export function avatarUrl(user, origin) {
  return user.avatar ? `${origin}${user.avatar}`
    : `${origin}/avatar/${encodeURIComponent(user.id)}.svg?v=${encodeURIComponent(user.full_name)}`;
}

export function userShape(user, origin) {
  if (!user) return null;
  const avatar = avatarUrl(user, origin);
  const pinCount = db.prepare('SELECT COUNT(*) AS n FROM pins WHERE pinner_id = ?').get(user.id).n;
  const boardCount = getBoards(user.id).length;
  const follows = followCounts(user.id);
  const followedByMe = isFollowing(user.id);
  return {
    node_id: nodeId('User', user.id),
    id: String(user.id),
    username: user.username,
    full_name: user.full_name,
    first_name: user.first_name || user.full_name.split(/\s+/)[0],
    last_name: user.last_name || user.full_name.split(/\s+/).slice(1).join(' '),
    about: user.about || '',
    website_url: user.website_url || '',
    follower_count: follows.followers,
    following_count: follows.following,
    explicit_user_following_count: follows.following,
    explicitly_followed_by_me: followedByMe,
    pin_count: pinCount,
    board_count: boardCount,
    has_published_pins: pinCount > 0,
    story_pin_count: 0,
    eligible_profile_tabs: [],
    is_partner: false,
    is_default_image: !user.avatar,
    is_private_profile: false,
    is_subscriber: false,
    show_creator_profile: false,
    partner: null,
    image_large_url: avatar,
    image_medium_url: avatar,
    image_small_url: avatar,
    is_ads_only_profile: false,
    is_verified_merchant: false,
    verified_identity: {},
  };
}

export function boardShape(board, origin) {
  if (!board) return null;
  const owner = userShape(getUser(board.user_id), origin) || userShape(getUser(currentUserId()), origin);
  const pinCount = db.prepare('SELECT COUNT(*) AS n FROM saves WHERE board_id = ?')
    .get(String(board.id)).n;
  const savedPins = db.prepare(`
    SELECT p.* FROM pins p JOIN saves s ON s.pin_id = p.id
    WHERE s.board_id = ? ORDER BY s.id DESC LIMIT 4
  `).all(String(board.id));
  const cover = (board.cover_pin_id && getPin(board.cover_pin_id)) || savedPins[0] || null;
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
    url: `/${owner?.username || 'me'}/${slugifyBoardName(board.name)}/`,
    pin_count: pinCount,
    collaborator_count: 0,
    collaborating_users: [],
    is_collaborative: false,
    owner,
    image_cover_url: coverUrl,
    image_cover_hd_url: coverUrl,
    cover_images: {
      '236x': coverSize(236),
      '474x': coverSize(474),
      orig: coverSize(cover?.width || 474),
    },
    pin_thumbnail_urls: savedPins.map((pin) => `${origin}${pin.image_path}`),
    images: { '236x': savedPins.map((pin) => ({ url: `${origin}${pin.image_path}` })) },
    section_count: 0,
    created_at: board.created_at,
  };
}

export function pinShape(pin, { origin, withBoard = true } = {}) {
  const tags = (() => {
    try { return JSON.parse(pin.tags || '[]'); } catch { return []; }
  })();
  const pinner = userShape(getUser(pin.pinner_id), origin) || userShape(getUser(currentUserId()), origin);
  const saved = isSaved(pin.id);
  const liked = isLiked(pin.id);
  const counts = pinCounts(pin.id);
  const boards = getBoards(currentUserId());
  const board = withBoard && boards.length ? boardShape(boards[0], origin) : null;

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
    comment_count: counts.comments,
    total_reaction_count: counts.likes,
    reaction_counts: counts.likes ? { 1: counts.likes } : {},
    reaction_by_me: liked ? 1 : 0,
    viewer_reaction: liked ? 1 : null,
    pinner,
    board,
    boards: boards.map((b) => boardShape(b, origin)),
    tags: tags.map((tag) => ({ id: tag, name: tag.replaceAll('-', ' ') })),
    aggregated_pin_data: { node_id: nodeId('AggregatedPinData', pin.id) },
    pin_join: { visual_annotation: [] },
    shopping_flags: [],
    did_its: [],
    access: [],
    tracking_params: '',
    is_saved: saved,
    is_liked: liked,
    attribution: { type: 'pinterest', source: 'local' },
    metadata: { pin_id: String(pin.id) },
  };
}

export function commentShape(comment, origin) {
  return {
    id: String(comment.id),
    text: comment.text,
    created_at: comment.created_at,
    user: userShape(getUser(comment.user_id), origin),
  };
}

export function resourceEnvelope(name, data, options = {}) {
  return {
    resource_response: {
      data,
      bookmark: options.bookmark ?? null,
      endpoint_name: `${name}/get/`,
      http_status: 200,
      message: null,
      status: 'success',
      code: 0,
      metadata: {},
      aux_data: options.auxData || {},
    },
    client_context: {
      request_identifier: String(Date.now()),
      csrf_token: null,
      user_id: currentUserId(),
    },
    resource: { name, options: options.options || {} },
    request_identifier: String(Date.now()),
  };
}

export function searchPins(query, { origin, limit = 100 } = {}) {
  const needles = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  let rows;
  if (needles.length === 0) {
    rows = db.prepare('SELECT * FROM pins ORDER BY rowid DESC LIMIT ?').all(limit);
  } else {
    rows = db.prepare('SELECT * FROM pins ORDER BY rowid DESC LIMIT 500').all()
      .filter((pin) => {
        const haystack = `${pin.title} ${pin.description} ${pin.tags}`.toLowerCase();
        return needles.some((needle) => haystack.includes(needle));
      })
      .slice(0, limit);
  }
  return rows.map((pin) => pinShape(pin, { origin }));
}
