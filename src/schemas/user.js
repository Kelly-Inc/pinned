import { nodeId } from '../util/ids.js';
import { countPinsBy, countBoards, followCounts, isFollowing } from '../database/index.js';

/** Uploaded avatar, or the generated initial avatar. */
export function avatarUrl(user, origin) {
  return user.avatar
    ? `${origin}${user.avatar}`
    : `${origin}/avatar/${encodeURIComponent(user.id)}.svg?v=${encodeURIComponent(user.full_name)}`;
}

export function userShape(user, origin) {
  if (!user) return null;
  const avatar = avatarUrl(user, origin);
  const pinCount = countPinsBy(user.id);
  const follows = followCounts(user.id);
  const names = String(user.full_name || '').split(/\s+/);
  return {
    node_id: nodeId('User', user.id),
    id: String(user.id),
    type: 'user',
    username: user.username,
    full_name: user.full_name,
    first_name: user.first_name || names[0],
    last_name: user.last_name || names.slice(1).join(' '),
    about: user.about || '',
    website_url: user.website_url || '',
    follower_count: follows.followers,
    following_count: follows.following,
    explicit_user_following_count: follows.following,
    explicitly_followed_by_me: isFollowing(user.id),
    pin_count: pinCount,
    board_count: countBoards(user.id),
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
