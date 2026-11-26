// Boot data patches: make the client start authenticated, as this user,
// against this server.
import { avatarUrl } from '../../schemas/index.js';

export function patchBootData(data, { origin, user }) {
  const ctx = data.context;
  Object.assign(ctx, {
    is_authenticated: true,
    autologin: null,
    country: 'US',
    country_from_ip: 'US',
    country_from_hostname: 'US',
    locale: 'en-US',
    full_path: '/',
    current_url: `${origin}/`,
    origin,
    request_host: new URL(origin).host,
    theme: 'light',
    userId: user.id,
    loginState: 1,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      image_medium_url: avatarUrl(user, origin),
      image_large_url: avatarUrl(user, origin),
      is_verified_merchant: false,
      verified_identity: {},
    },
  });
  // Dark mode is behind an experiment in this client build.
  if (data.experiments) {
    data.experiments.triggerable = { ...(data.experiments.triggerable || {}), dweb_dark_mode: 'enabled' };
    data.experiments.active = { ...(data.experiments.active || {}), dweb_dark_mode: 'enabled' };
  }
  data.initialHandlerId = 'www/index.js';
  data.renderMode = 'shellReady';
}

export function patchInitialState(data, { origin, user }) {
  const state = data.initialReduxState;
  Object.assign(state.session, { isAuthenticated: true, userId: user.id, origin, isDataSaver: false });
  const viewer = {
    // AppWrapper builds ViewerContext from a user with login_state.
    login_state: 1,
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    image_medium_url: avatarUrl(user, origin),
    image_large_url: avatarUrl(user, origin),
    follower_count: 0,
    following_count: 0,
    pin_count: 0,
    board_count: 0,
    is_partner: false,
    verified_identity: {},
  };
  // Profile components index users by id, username and the "me" alias.
  state.users[user.id] = viewer;
  state.users[user.username] = viewer;
  state.users.me = viewer;
  state.currentUserTracker.isAuthenticated = 1;
  state.feeds = state.feeds || {};
  state.resources = state.resources || {};
}
