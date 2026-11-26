import {
  db, currentUserId, getUser, getUserByUsername, getPin, listPins, countPins,
  getBoards, getBoard, getBoardBySlug, createBoard, updateBoard, savePin, unsavePin,
  toggleLike, addComment, getComments, isSaved, updatePin, deletePin, deleteBoard,
  setLike, deleteComment, ownBoard, getSettings, updateSettings,
  followUser, unfollowUser, listFollowing, listFollowers,
} from './db.js';
import { registerUpload, registration, uploadStatus, getUpload, imageUploadStatus, removeAvatar } from './uploads.js';
import { pinShape, userShape, boardShape, resourceEnvelope, searchPins, commentShape } from './shape.js';

const json = (res, value, status = 200) => {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(body);
};

function parseOptions(url) {
  try {
    const data = JSON.parse(url.searchParams.get('data') || '{}');
    return {
      options: data.options || {},
      context: data.context || {},
      bookmark: url.searchParams.get('bookmark') || data.bookmark || null,
    };
  } catch {
    return { options: {}, context: {}, bookmark: null };
  }
}

function mergeResourceData(parsed) {
  // Pinterest posts either JSON or application/x-www-form-urlencoded bodies.
  // In both cases the resource options live under `data.options`, but the
  // client-side resource helpers expect them at the top level too.
  if (!parsed || typeof parsed !== 'object') return {};
  let data = parsed.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return parsed; }
  }
  if (!data || typeof data !== 'object') return parsed;
  return {
    ...parsed,
    ...(data.options || {}),
    options: data.options || {},
    context: data.context || {},
  };
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { return resolve(mergeResourceData(JSON.parse(body))); } catch {}
      const params = new URLSearchParams(body);
      if (params.has('data')) {
        try { return resolve(mergeResourceData({ data: params.get('data') })); } catch {}
      }
      resolve({});
    });
  });
}

function pinsForBoard(boardId, origin) {
  const rows = db.prepare(`
    SELECT p.* FROM pins p JOIN saves s ON s.pin_id = p.id
    WHERE s.board_id = ? ORDER BY s.created_at DESC LIMIT 200
  `).all(String(boardId));
  return rows.map((pin) => pinShape(pin, { origin }));
}

function userPins(userId, origin) {
  const user = getUser(userId) || getUserByUsername(userId) || getUser(currentUserId());
  const rows = db.prepare('SELECT * FROM pins WHERE pinner_id = ? ORDER BY rowid DESC LIMIT 200')
    .all(user.id);
  return rows.map((pin) => pinShape(pin, { origin }));
}

// A profile's Pins tab: pins the user created plus pins they saved, newest first.
function profilePins(identity, origin) {
  const user = resolveUser(identity);
  const rows = db.prepare(`
    SELECT p.*, MAX(t.at) AS sort_at FROM pins p JOIN (
      SELECT id AS pin_id, created_at AS at FROM pins WHERE pinner_id = ?
      UNION ALL
      SELECT pin_id, created_at AS at FROM saves WHERE user_id = ?
    ) t ON t.pin_id = p.id
    GROUP BY p.id ORDER BY sort_at DESC, p.rowid DESC LIMIT 500
  `).all(user.id, user.id);
  return rows.map((pin) => pinShape(pin, { origin }));
}

function feedPins(origin, offset = 0, limit = 100) {
  const rows = listPins({ limit, offset });
  return rows.map((pin) => pinShape(pin, { origin }));
}

function resolveUser(identity) {
  return getUser(identity) || getUserByUsername(identity) || getUser(currentUserId());
}

function boardFromOptions(options) {
  const byId = getBoard(options.board_id || options.id || options.boardId);
  if (byId) return byId;
  const identity = options.username || options.user_id || options.userId;
  if (identity) {
    const user = resolveUser(identity);
    const bySlug = options.slug || options.board_slug || options.boardSlug;
    if (bySlug) return getBoardBySlug(identity, bySlug);
    const userBoards = getBoards(user.id);
    if (userBoards.length) return userBoards[0];
  }
  return getBoards()[0] || null;
}

function isBoardToolsPath(urlPath) {
  return /\/v3\/boards\/[^/?]+\/tools\/?(?:\?|$)/.test(String(urlPath || ''));
}

async function handleResource(req, res, url, name, method) {
  const { options, bookmark } = parseOptions(url);
  const origin = url.origin;
  const body = req.method === 'POST' ? await parseBody(req) : {};

  // ---- v3 calls tunnelled through ApiResource ---------------------------
  if (name === 'ApiResource') {
    const api = method === 'get' ? options : (body.options || {});
    const apiUrl = String(api.url || '');
    let inner = api.data || {};
    if (typeof inner === 'string') { try { inner = JSON.parse(inner); } catch { inner = {}; } }
    const reply = (data) => json(res, resourceEnvelope(name, data, { options: api }));
    if (apiUrl.startsWith('/v3/media/uploads/register/batch')) {
      let list = inner.media_info_list || [];
      if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
      const out = {};
      for (const item of list) out[item.id] = registration(registerUpload(), origin);
      return reply(out);
    }
    if (apiUrl.startsWith('/v3/media/uploads/register')) return reply(registration(registerUpload(), origin));
    if (/^\/v3\/media\/uploads\/?$/.test(apiUrl)) {
      let ids = inner.upload_ids || [];
      if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = String(ids).split(','); } }
      return reply(uploadStatus(ids));
    }
    // Profile / account settings.
    if (/^\/v3\/users\/(me|settings)\/(viewer\/)?$/.test(apiUrl) || /^\/v3\/users\/me\/?$/.test(apiUrl)) {
      if (method !== 'get') {
        const result = updateSettings(inner);
        if (result.error) return json(res, { resource_response: { status: 'failure', message: result.error, message_detail: result.error, code: 400, data: null } }, 400);
      }
      const me = getUser(currentUserId());
      return reply({ ...userShape(me, origin), ...getSettings(), pronouns: (() => { try { return JSON.parse(me.settings || '{}').pronouns || []; } catch { return []; } })() });
    }
    if (apiUrl.startsWith('/v3/images/upload/status')) {
      return reply(imageUploadStatus([inner.tracking_id].flat().filter(Boolean).map(String)));
    }
    if (apiUrl.startsWith('/v3/settings/notifications')) {
      const me = getUser(currentUserId());
      let extra = {}; try { extra = JSON.parse(me.settings || '{}'); } catch {}
      let prefs = {}; try { prefs = JSON.parse(extra.notification_prefs || '{}'); } catch {}
      if (method !== 'get') {
        let upd = inner.updated_settings || [];
        if (typeof upd === 'string') { try { upd = JSON.parse(upd); } catch { upd = []; } }
        for (const u of upd) prefs[`${u.section}.${u.option}.${u.type}`] = !!u.value;
        updateSettings({ notification_prefs: JSON.stringify(prefs) });
        return reply({});
      }
      const CH = [['push', 'Push'], ['email', 'Email']];
      const CATS = [
        ['activity', 'Activity on your Pins and boards', [
          ['comments', 'Comments', 'When someone comments on your Pins'],
          ['reactions', 'Reactions', 'When someone likes your Pins'],
          ['saves', 'Saves', 'When someone saves your Pins'],
        ]],
        ['social', 'Your network', [
          ['followers', 'New followers', 'When someone follows you'],
          ['following_pins', 'Pins from people you follow', 'When people you follow publish new Pins'],
        ]],
      ];
      return reply(CATS.map(([key, label, subs]) => ({
        key, label,
        subcategories: subs.map(([skey, slabel, desc]) => {
          const opts = CH.map(([ch, chLabel]) => ({
            channel: ch, label: chLabel, category_key: key, subcategory_key: skey,
            value: prefs[`${key}.${skey}.${ch}`] ?? true,
          }));
          const on = opts.filter((o) => o.value).map((o) => o.label);
          return { key: skey, label: slabel, description: desc, channel_options: opts,
            channel_options_label: on.length ? on.join(', ') : 'Off' };
        }),
      })));
    }
    if (apiUrl.startsWith('/v3/users/privacy_data_settings')) {
      const f = (name, label, description, value = true) => ({ name, label, description, value, is_inverted_value: false });
      return reply([
        { title: 'Privacy', description: 'Control who can see and interact with your profile.', settings_field: [
          f('hide_from_search_engines', 'Search privacy', 'Hide your profile from search engines', false),
          f('allow_mentions', 'Mentions', 'Allow people to @mention you in comments and descriptions'),
        ] },
        { title: 'Personalization', description: 'Data used to tailor your feed on this instance.', settings_field: [
          f('use_activity_for_recommendations', 'Use your activity', 'Use the Pins you save, like and create to tailor your home feed'),
        ] },
      ]);
    }
    if (apiUrl.startsWith('/v3/users/pronouns')) {
      return reply(['she/her', 'he/him', 'they/them', 'ze/hir', 'xe/xem', 'ey/em', 've/ver', 'tey/ter', 'e/em', 'it/its', 'any pronouns', 'ask me']
        .map((t) => ({ id: t, label: t, display_text: t, pronoun: t })));
    }
    if (/^\/v3\/users\/[^/]+\/metadata\/?$/.test(apiUrl)) return reply({});
    const reactUrl = apiUrl.match(/^\/v3\/pins\/([^/]+)\/react\/?$/);
    if (reactUrl && method !== 'get') {
      const pinId = decodeURIComponent(reactUrl[1]);
      if (!setLike(pinId, method !== 'delete')) return json(res, { status: 'failure', message: 'Pin not found' }, 404);
      return reply(pinShape(getPin(pinId), { origin }));
    }
    if (/^\/v3\/storypins\/drafts\/?$/.test(apiUrl) && method !== 'get') {
      return reply({ id: `draft-${Date.now()}`, type: 'storypindraft' });
    }
    if (apiUrl.startsWith('/v3/storypins/drafts/')) return reply({});
    if (/^\/v3\/storypins\/?$/.test(apiUrl) && method !== 'get') {
      let story = inner.story_pin || {};
      if (typeof story === 'string') { try { story = JSON.parse(story); } catch { story = {}; } }
      const blocks = (story.pages || []).flatMap((pg) => pg.blocks || []);
      const signature = story.metadata?.pin_image_signature
        || blocks.find((b) => b.image_signature)?.image_signature || inner.image_signature;
      const upload = getUpload(signature);
      if (!upload || upload.user_id !== currentUserId() || upload.status !== 'succeeded') {
        return json(res, { status: 'failure', message: 'Image upload not found', code: 400 }, 400);
      }
      const title = String(inner.title || story.metadata?.pin_title || '').slice(0, 100);
      const description = String(inner.description || blocks.filter((b) => b.type === 0 && b.text).map((b) => b.text).join('\n') || '').slice(0, 800);
      let tags = inner.topic_tags || [];
      if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = []; } }
      const id = String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      db.prepare(`
        INSERT INTO pins (id, title, description, link, image_path, width, height, pinner_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, title, description, String(inner.link || ''), upload.image_path,
        upload.width, upload.height, currentUserId(), JSON.stringify(Array.isArray(tags) ? tags.map(String) : []));
      const boardId = inner.board_id || inner.board;
      if (boardId && ownBoard(boardId)) savePin({ pinId: id, boardId });
      const pin = pinShape(getPin(id), { origin });
      return reply({ ...pin, image_signature: upload.id, image_square_url: pin.images['236x'].url, story_pin_data_id: id });
    }
    // Analytics/anti-spam/verification calls from the official client: accept quietly.
    if (/^\/v3\/(spam|callback|sessions\/verify|batch)\b/.test(apiUrl)) return reply({});
    if (method !== 'get') {
      console.log('[unhandled ApiResource]', method, apiUrl, JSON.stringify(inner).slice(0, 1500));
    }
  }

  // ---- mutations -------------------------------------------------------
  if (method === 'create' || method === 'update' || method === 'delete') {
    if (name === 'BoardResource' && method === 'create') {
      const board = createBoard({
        name: body.name || options.name || 'New board',
        description: body.description || '',
        isSecret: !!body.is_secret,
      });
      return json(res, resourceEnvelope(name, boardShape(board, origin), { options }));
    }
    if (name === 'UserSettingsResource') {
      const result = updateSettings({ ...options, ...(body.options || {}), ...body });
      if (result.error) return json(res, { resource_response: { status: 'failure', message: result.error, message_detail: result.error, code: 400, data: null } }, 400);
      return json(res, resourceEnvelope(name, result.settings, { options }));
    }
    const forbidden = () => json(res, { status: 'failure', message: 'Not allowed', code: 403 }, 403);
    const opt = { ...options, ...body };
    if (name === 'BoardResource' && method === 'update') {
      const board = updateBoard(opt.board_id, opt);
      return board ? json(res, resourceEnvelope(name, boardShape(board, origin), { options })) : forbidden();
    }
    if (name === 'BoardResource' && method === 'delete') {
      return deleteBoard(opt.board_id) ? json(res, resourceEnvelope(name, null, { options })) : forbidden();
    }
    if (name === 'PinResource' && method === 'create') {
      const boardId = opt.board_id && ownBoard(opt.board_id) ? String(opt.board_id) : null;
      const id = String(Date.now());
      db.prepare(`
        INSERT INTO pins (id, title, description, link, image_path, pinner_id, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, String(opt.title || ''), String(opt.description || ''), String(opt.link || ''),
        String(opt.image_path || opt.image_url || ''), currentUserId(),
        JSON.stringify(Array.isArray(opt.tags) ? opt.tags : []));
      if (boardId) savePin({ pinId: id, boardId });
      return json(res, resourceEnvelope(name, pinShape(getPin(id), { origin }), { options }));
    }
    if (name === 'PinResource' && method === 'update') {
      const pin = updatePin(opt.id || opt.pin_id, opt);
      return pin ? json(res, resourceEnvelope(name, pinShape(pin, { origin }), { options })) : forbidden();
    }
    if (name === 'PinResource' && method === 'delete') {
      const id = opt.id || opt.pin_id;
      if (deletePin(id)) return json(res, resourceEnvelope(name, null, { options }));
      // Not your pin: "delete" means remove it from your saves.
      unsavePin(id);
      return json(res, resourceEnvelope(name, null, { options }));
    }
    if (name === 'AggregatedCommentResource' && method === 'create') {
      const pinId = opt.pinId || opt.objectId;
      const rows = addComment(pinId, opt.text);
      if (!rows) return json(res, { status: 'failure', message: 'Empty comment' }, 400);
      return json(res, resourceEnvelope(name, commentShape(rows[0], origin), { options }));
    }
    if (name === 'AggregatedCommentResource' && method === 'delete') {
      return deleteComment(opt.commentId) ? json(res, resourceEnvelope(name, null, { options })) : forbidden();
    }
    if (name === 'RepinResource' && method === 'create') {
      const pinId = body.pin_id || options.pin_id || body.pinId;
      if (!savePin({ pinId, boardId: body.board_id || options.board_id })) {
        return json(res, { status: 'failure', message: 'Not allowed', code: 403 }, 403);
      }
      return json(res, resourceEnvelope(name, { pin_id: String(pinId) }, { options }));
    }
    return json(res, resourceEnvelope(name, {}, { options }));
  }

  // ---- reads -----------------------------------------------------------
  let data;
  let auxData;

  switch (name) {
    case 'UserHomefeedResource':
    case 'HomefeedStreamResource':
    case 'BestPinsFeedAltResource':
    case 'StoryFeedResource': {
      const offset = bookmark ? Math.max(0, parseInt(String(bookmark), 10) || 0) : 0;
      const pins = feedPins(origin, offset, Number(options.page_size) || 60);
      data = pins;
      auxData = { feed_type: 'homefeed', count: pins.length };
      break;
    }
    case 'SearchTabResource':
      // SearchBoxDataContext spreads this directly into recommendedSearches.
      data = [];
      break;
    case 'AdvancedTypeaheadResource':
      // The typeahead reducer concatenates data.items.
      data = { items: [], query: options.term || '' };
      break;
    case 'BaseSearchResource':
    case 'SearchResource': {
      const scope = options.scope || 'pins';
      const query = options.query || '';
      if (scope === 'boards') {
        const boards = getBoards(currentUserId()).filter((b) =>
          `${b.name} ${b.description}`.toLowerCase().includes(query.toLowerCase()));
        data = {
          results: boards.map((b) => ({ ...boardShape(b, origin), type: 'board' })),
          query, scope, oneBarModules: [], rankedGuides: [],
        };
      } else {
        const results = searchPins(query, {
          origin,
          limit: Number(options.page_size) || 100,
        });
        // Pinterest wraps search hits in {type:'pin', pin:...} sometimes; the
        // grid normalizer accepts bare pins, which is what we return.
        data = {
          results,
          query,
          scope,
          oneBarModules: [],
          rankedGuides: [],
          shouldAppendGlobalSearch: false,
          sensitivity: 'none',
          queryL1VerticalIds: [],
          clientTrackingParams: {},
        };
      }
      break;
    }
    case 'BoardFeedResource':
    case 'BoardSectionPinsResource':
    case 'UserPinsResource':
    case 'RelatedPinFeedResource':
    case 'RelatedStreamResource':
    case 'CategoryFeedResource':
    case 'TodayArticleFeedResource':
      data = options.board_id
        ? pinsForBoard(options.board_id, origin)
        : profilePins(options.user_id || options.username || currentUserId(), origin);
      break;
    case 'BoardResource': {
      data = boardShape(boardFromOptions(options), origin);
      break;
    }
    case 'BoardPickerBoardsResource': {
      const boards = getBoards(currentUserId()).map((b) => boardShape(b, origin));
      // The save flyout normalizes this resource with a schema that looks for
      // all_boards and boards_shortlist on the response object.
      data = { all_boards: boards, boards_shortlist: boards };
      break;
    }
    case 'BoardsResource':
    case 'BoardsFeedResource':
      data = getBoards(currentUserId()).map((b) => ({ ...boardShape(b, origin), type: 'board' }));
      break;
    case 'UserSettingsResource':
      data = getSettings();
      break;
    case 'UserResource':
    case 'ActiveUserResource': {
      const id = options.user_id || options.username || currentUserId();
      const user = resolveUser(id);
      data = { ...userShape(user, origin), boards: getBoards(user.id).map((b) => boardShape(b, origin)) };
      break;
    }
    case 'PinResource':
    case 'PinPageResource':
    case 'PinInfoResource': {
      const pin = getPin(options.pin_id || options.id || options.pinId);
      data = pin ? pinShape(pin, { origin }) : null;
      break;
    }
    case 'UnifiedCommentsResource': {
      const pinId = options.pin_id || options.id;
      const rows = getComments(pinId).map((c) => ({
        id: String(c.id),
        text: c.text,
        created_at: c.created_at,
        user: userShape(getUser(c.user_id), origin),
      }));
      data = { results: rows, comment_count: rows.length };
      break;
    }
    case 'UserFollowingResource':
    case 'UserFollowersResource': {
      const user = resolveUser(options.username || options.user_id || currentUserId());
      const rows = name === 'UserFollowingResource' ? listFollowing(user.id) : listFollowers(user.id);
      data = rows.map((u) => ({ ...userShape(u, origin), type: 'user' }));
      break;
    }
    case 'ApiResource': {
      const apiOpts = body.options && body.options.url ? body.options : options;
      const urlPath = apiOpts.url || '';
      const userPinsMatch = urlPath.match(/^\/v3\/users\/([^/]+)\/(?:filtered\/)?pins\/?$/);
      if (userPinsMatch) {
        const who = userPinsMatch[1] === 'me' ? currentUserId() : decodeURIComponent(userPinsMatch[1]);
        data = profilePins(who, origin);
        break;
      }
      const pinInUrl = urlPath.match(/\/v3\/pins\/([^/?]+)\/?(?:\?|$)/)?.[1];
      if (urlPath.includes('recent/engaged/pin/stories')) data = [];
      else if (urlPath.includes('/stela/')) data = [];
      else if (urlPath.includes('ghost_queries')) data = [];
      else if (urlPath.includes('contact_requests')) data = [];
      else if (isBoardToolsPath(urlPath)) data = [];
      else if (urlPath.includes('board_title_suggestions')) data = [];
      else if (pinInUrl) {
        const pin = getPin(decodeURIComponent(pinInUrl));
        data = pin ? { ...pinShape(pin, { origin }), board_title_suggestions: [] } : {};
      } else if (urlPath.includes('boards')) data = getBoards(currentUserId()).map((b) => boardShape(b, origin));
      else if (urlPath.includes('pins')) data = feedPins(origin);
      else data = {};
      break;
    }
    default:
      data = Array.isArray(options.ids) ? [] : [];
      break;
  }

  return json(res, resourceEnvelope(name, data, { options, bookmark, auxData }));
}

async function handleV3(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;
  const origin = url.origin;
  const body = method === 'GET' ? {} : await parseBody(req);

  const followMatch = pathname.match(/^\/v3\/users\/([^/]+)\/follow\/?$/);
  if (followMatch) {
    const target = getUser(decodeURIComponent(followMatch[1])) || getUserByUsername(decodeURIComponent(followMatch[1]));
    if (!target) return json(res, { error: 'user not found' }, 404);
    if (method === 'DELETE') unfollowUser(target.id);
    else followUser(target.id);
    return json(res, userShape(getUser(target.id), origin));
  }
  const userMatch = pathname.match(/^\/v3\/users\/([^/]+)\/?$/);
  if (userMatch && userMatch[1] !== 'me') {
    const user = getUser(userMatch[1]) || getUserByUsername(decodeURIComponent(userMatch[1]));
    return json(res, user ? userShape(user, origin) : {});
  }
  if (pathname === '/v3/user_account' || pathname === '/v3/users/me') {
    const user = getUser(currentUserId());
    return json(res, {
      account_type: 'personal', id: currentUserId(), username: user.username,
      full_name: user.full_name, profile_image: userShape(user, origin).image_medium_url,
      country: 'US', locale: 'en_US', is_partner: false, is_tester: false,
    });
  }
  if (pathname.includes('/save/') && method === 'POST') {
    const pinId = pathname.match(/\/pins\/([^/]+)\/save/)?.[1] || body.pin_id;
    if (!savePin({ pinId, boardId: body.board_id })) return json(res, { error: 'not allowed' }, 403);
    return json(res, { pin_id: String(pinId), saved: true });
  }
  const reactMatch = pathname.match(/^\/v3\/pins\/([^/]+)\/react\/?$/);
  if (reactMatch) {
    const pinId = decodeURIComponent(reactMatch[1]);
    if (!setLike(pinId, method !== 'DELETE')) return json(res, { error: 'pin not found' }, 404);
    return json(res, pinShape(getPin(pinId), { origin }));
  }
  if (isBoardToolsPath(pathname) && method === 'GET') return json(res, []);
  if (pathname.includes('/boards') && method === 'GET') {
    return json(res, { items: getBoards(currentUserId()).map((b) => boardShape(b, origin)) });
  }
  if (pathname.includes('/boards') && method === 'POST') {
    const board = createBoard({ name: body.name || 'New board', description: body.description || '' });
    return json(res, boardShape(board, origin));
  }
  if (pathname.includes('/pins') && method === 'GET') {
    return json(res, { items: feedPins(origin) });
  }
  return json(res, {});
}

async function handleGraphql(req, res, url) {
  const body = await parseBody(req);
  const name = req.headers['x-pinterest-graphql-name'] || body.queryName || 'unknown';
  const origin = url.origin;
  const vars = body.variables || {};

  let data = {};
  if (/RemoveProfilePhoto/i.test(name)) {
    removeAvatar();
    data = { v3EditSettingsHandler: { __typename: 'V3EditSettingsHandlerAssociatedResponse', data: getSettings() } };
  } else if (name.includes('SearchTabHandler')) {
    // SearchPageSearchTabHandlerQuery reads this connection to paint the
    // suggested-story strip above the normal pin grid.
    data = {
      v3SearchTabHandlerQuery: {
        __typename: 'V3SearchTabHandler',
        data: {
          __typename: 'V3SearchTabHandlerData',
          connection: {
            __typename: 'V3SearchTabHandlerDataConnection',
            edges: [],
            pageInfo: { __typename: 'PageInfo', endCursor: null, hasNextPage: false },
          },
        },
      },
    };
  } else if (name.includes('Closeup') || name.includes('PinDetail')) {
    const pin = getPin(vars.pinId || Object.values(vars)[0]);
    data = { pin: pin ? pinShape(pin, { origin }) : null };
  } else if (name.includes('Board')) {
    const board = getBoard(vars.boardId || Object.values(vars)[0]);
    data = { board: board ? boardShape(board, origin) : null };
  } else if (name.includes('User')) {
    const identity = vars.username || vars.userId || vars.id || currentUserId();
    const user = getUser(identity) || getUserByUsername(identity) || getUser(currentUserId());
    data = { user: userShape(user, origin) };
  } else if (name.includes('Search')) {
    data = { search: { results: searchPins(vars.query || '', { origin }) } };
  }

  // Include a permissive root so fragments can resolve without hard failures.
  return json(res, { data, extensions: {} });
}

async function handleMisc(req, res, url) {
  const pathname = url.pathname;
  if (pathname.startsWith('/refresh')) {
    return json(res, { ok: true, csrf_token: 'local', user_id: currentUserId() });
  }
  if (pathname.startsWith('/_/')) return json(res, {});
  return json(res, { ok: true });
}

export async function handleApi(req, res, url) {
  const pathname = url.pathname;

  const resourceMatch = pathname.match(/^\/resource\/([A-Za-z0-9_]+)\/(get|create|update|delete)\/?$/);
  if (resourceMatch) {
    return handleResource(req, res, url, resourceMatch[1], resourceMatch[2]);
  }
  if (pathname.startsWith('/v3/')) return handleV3(req, res, url);
  if (pathname === '/_/graphql/' || pathname === '/_/graphql') return handleGraphql(req, res, url);
  if (pathname.startsWith('/api/')) {
    const fake = new URL(url.toString());
    fake.pathname = '/v3/' + pathname.slice('/api/'.length);
    return handleV3(req, res, fake);
  }
  return handleMisc(req, res, url);
}

export { json };
