# HANDOFF: notes for AI agents working on Pinned

Read this before changing anything. It covers what this project is, how to work
on it safely, and the non-obvious behavior of the vendored client that took
time to discover. Use [README.md](README.md) for users and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is laid out.

## What this is

Pinned is a self-hosted Pinterest alternative. It serves **Pinterest's real web
client** (minified, vendored in `vendor/`, about 1,500 files) and implements the
backend that client talks to: Node 22, plain `node:http`, and `node:sqlite`, with
no frameworks and no runtime dependencies.

The client believes it is talking to pinterest.com. **Almost every bug is the
client asking for something in a shape we don't provide.** The work is mostly:
see what the client requests, find what it expects in the minified code, and
implement that.

- Repo: `github.com/Kelly-Inc/pinned` (private). Commit as `heyskylo` (already set in repo-local git config).
- Owner's style: wants it to work 1:1 like Pinterest, polished, and verified, not assumed.

## Golden rules

1. **Never claim something works without testing it in the real client.** API
   tests passing is not enough; the client may expect a different shape. Use the
   browser (see "Debugging the client").
2. **Run `npm test` before and after every change.** All tests must pass, and
   `npm run check` must report that all imports resolve.
3. **One file per endpoint.** New v3 endpoint: a new file in `src/api/routes/v3/`.
   New resource: a new file in `src/api/resources/`. Don't pile logic into the
   core files.
4. **Schema changes need a new migration file** in `src/database/migrations/`,
   added to `index.js`. Never edit a migration that has shipped. Use
   `addColumn()`, which is idempotent.
5. **Ownership checks belong in models** (`ownPin`, `ownBoard`, `ownUpload`),
   not in endpoints.
6. **No placeholder data.** The owner hates fake numbers: there were hardcoded
   follower counts once. Counts are computed live. A new account must show
   nothing.

## Commands

```bash
npm start            # port 3000, data in ./data
npm run dev          # restart on file changes
npm test             # 52 API tests, real server, throwaway database (~20s)
npm run test:e2e     # 10 browser tests, headless Chromium (~3 min)
npm run routes       # list every implemented endpoint
npm run check        # verify relative imports resolve
PINNED_LOG_LEVEL=debug npm start   # logs "[v3 unhandled]" for every unimplemented call
```

Tests start their own server on a random port, with `PINNED_DATA_DIR` set to a
temp directory, so they never touch real data.

## The live deployment (this machine)

- The live instance runs from `/root/board/pinterestd` on **port 3000**, logging to `/tmp/pinterestd.log`. It is reachable on the server's public IP.
- **Restart safely:**
  ```bash
  cd /root/board/pinterestd
  for p in $(ss -ltnp | grep ':3000 ' | grep -oP 'pid=\K\d+'); do kill $p; done; sleep 1
  (env -u PORT -u PINTERESTD_DB -u PINNED_DATA_DIR nohup node --disable-warning=ExperimentalWarning server.js > /tmp/pinterestd.log 2>&1 &)
  sleep 3; cat /tmp/pinterestd.log
  ```
- **Don't kill other node processes.** Another app (`/panel`) runs `node server.js` too. Find processes by port, never with `pkill -f "node server.js"`.
- **Don't let test env vars leak into the live restart.** One past restart inherited `PORT=3999` and a test database path. That's why the command above uses `env -u ...`.
- **Don't run `pkill -f <pattern>`** where the pattern also appears in your own shell command: it kills your own shell.
- **Back up before anything that migrates the live database:**
  `node -e "new (require('node:sqlite').DatabaseSync)('data/pinterestd.sqlite').exec(\"VACUUM INTO '/root/board/backups/<name>.sqlite'\")"`
- Real data: `data/pinterestd.sqlite` and `data/media/uploads/`. Both are gitignored; never commit them.
- The site runs on **plain HTTP**. Consequences are covered under "Secure cookies" below.

## How a request flows

`server.js` → `src/server/app.js`:
static files → `/search` redirect → auth pages → session (sets the request user
through `runAs`) → uploads → API → app shell.

The client calls the API three ways (details in `docs/ARCHITECTURE.md`):

| Style | Example | Code |
|---|---|---|
| Resource | `GET /resource/PinResource/get/?data={"options":{"id":"1"}}` | `src/api/resources/PinResource.js` (`get`/`create`/`update`/`remove`) |
| v3 REST, **mostly tunnelled** | `POST /resource/ApiResource/create/` with `options:{url:"/v3/pins/1/react/",data:{}}` | `src/api/routes/v3/pins/#pin/react.js` (`post`/`del`) |
| GraphQL | `POST /_/graphql/` with header `x-pinterest-graphql-name` | `src/api/graphql/*.js` (regex `match` + `priority`) |

The `ApiResource` tunnel maps resource methods to HTTP verbs (create→POST,
update→PUT, delete→DELETE), so one route file serves both direct and tunnelled
calls.

## Client contracts we discovered (hard-won)

These are easy to break. Each was a real bug.

- **`reaction_by_me`** (1 or 0) on pins is what the client reads to show the
  filled heart after a reload. Not `is_liked`, not `viewer_reaction`.
- **Resource "get" can arrive as a POST** with options in the body (the profile
  Pins tab does `POST /resource/ApiResource/get/`). `core/resources.js` reads
  `body.options` when present. Keep it that way.
- **The pin upload flow:** `POST /v3/media/uploads/register/batch/` with
  `media_info_list` returns `{clientId: {upload_id, upload_url,
  upload_parameters}}`. The browser then POSTs multipart field `file` to
  `upload_url` (our `/upload/:id`, which must return 2xx). The client polls
  `GET /v3/media/uploads/?upload_ids=[...]` until it gets
  `{id: {status:'succeeded', signature}}`, then publishes with
  `POST /v3/storypins/` and `story_pin` JSON that references the signature.
  The signature is our upload id. Images under 200×300 are rejected client-side.
- **The avatar flow:** a multipart POST of field `img` to
  `/upload-profile-image/` returns `{image_upload_tracking_id}`. The client polls
  `/v3/images/upload/status/?tracking_id=` for **numeric** status `4` (done) or
  `5` (failed). Removing the photo is the GraphQL mutation
  `useRemoveProfilePhotoMutation`.
- **Edit profile** loads from `/v3/users/me/viewer/` and `/v3/users/settings/`,
  and saves through `UserSettingsResource` update with arbitrary fields. Profile
  fields are real columns; everything else goes in the `users.settings` JSON.
- **Notification settings** come from `/v3/settings/notifications/`:
  categories → `subcategories` → `channel_options` (`{channel, category_key,
  subcategory_key, value}`). Saving sends `updated_settings: [{type, section,
  option, value}]`.
- **Privacy and data** expects section descriptions as arrays of paragraphs.
  The client requests `platform: "desktop"` for `checkbox` fields with
  `label_desktop`, or `"mobile"` for `toggles` with `label_mobile` and
  `header_mobile`. Field names are the keys used to save preferences.
- **Related pins on desktop** load from `RelatedModulesResource` with
  `options.pin_id`. The closeup renders ordinary grid pins in the response.
- **Profile Pins filters** arrive as comma-separated `flag_filters`. Favorites
  use the pin star (`/v3/pins/:id/favorite/`) and are independent of reactions.
- **Messages** use `ConversationsResource` for lists and new conversations,
  `ConversationMessagesResource` for messages, and `/v3/conversations/:id/`
  for metadata. Set `should_show_messaging` on both the viewer and local
  recipient profiles to enable the Messages and Message buttons.
- **Shop-the-look** (`/v3/visual_search/stela/pins/:id/module/`) must return
  `[]`. Returning the feed blanks the pin page.
- **Dark mode** is gated by the `dweb_dark_mode` experiment (enabled in
  `src/client/shell/context.js`) and needs `context.theme === 'dark'` at boot.
  The client saves the choice to `localStorage.theme` and reloads; the injected
  `src/client/inject/theme.js` patches the boot JSON from that.
- **Secure cookies:** the client sets some cookies (`_pthm`, the theme) with
  `Secure`, so browsers drop them over HTTP. Don't rely on client cookies. Use
  `localStorage` or server state.
- **Hardcoded pinterest.com:** the vendored code links to
  `https://www.pinterest.com/settings` and similar, and builds some URLs at
  runtime from a constant `"www.pinterest.com"` host. There are two defenses:
  `src/client/vendor.js` rewrites code as it's served, and
  `src/client/inject/links.js` rewrites hrefs live and intercepts clicks. Add new
  app routes to **both** route lists.
- **Never let unknown URLs fall through to the app shell for assets.** The
  client loads a hidden `/assets/ct.html` iframe; serving the app there boots a
  second copy and doubles every request. `/assets/*` misses return 404.
- **The app-code cache is busted per restart:** the chunk loader path becomes
  `/webapp/_v<timestamp>/` (rewritten from `.p="/webapp/"` in the runtime chunk),
  and the code is served `immutable`.
- **Pin closeup layout:** the card sizes itself to its content, and sparse local
  pins collapse it. The CSS in `src/client/inject/fixes.css` fixes the widths.
  Re-check visually after touching it.
- **Context `request_host`** must be our host. The captured page had
  `www.pinterest.com`, and the client built off-site URLs from it.

## Debugging the client

Most of this work is reverse-engineering. The workflow that works:

1. **Reproduce in a headless browser** on a throwaway server, never the live one:
   ```bash
   PORT=3999 PINNED_DATA_DIR=/tmp/pinned-dbg node server.js &
   ```
   Chromium for playwright-core is at
   `/root/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`.
   Log `page.on('request')`, `pageerror` and `framenavigated`, and block
   `pinterest.com` with `context.route()` to catch off-site navigation. Take
   screenshots and look at them. `tests/e2e/app.test.js` is a working template.
2. **Find what the client calls:** filter the request log to `/resource/` and
   `/v3/`, or run with `PINNED_LOG_LEVEL=debug`. Ignore the noise: `ApiSResource`,
   `ApiCResource`, `UserExperience*`, `spam`, `batch`, `sessions/verify`.
3. **Find what it expects:** search the minified code around the endpoint string,
   and read how the response is consumed (for example `resource_response.data[id]`):
   ```bash
   grep -ohE '.{200}/v3/some/endpoint/.{400}' vendor/*.mjs | head -3
   ```
   `grep -E` with large `{n}` ranges can hit "exceeds complexity limits". Use a
   small Python script with `str.find()` instead.
4. **Write an API test** for the contract in `tests/api/`, implement it, run
   `npm test`, then confirm in the browser.

## Known issues and open work

Roughly in priority order:

- [ ] **Notifications and messages:** Updates shows new follows and comments
  with a badge. Local conversations support text and pin attachments, inbox
  badges and message history. Other activity types, contact requests and
  conversation management are open.
- [ ] **Search:** local text matching and Pin title suggestions are supported.
  Rich filters, board-specific suggestions and search history are open.
- [ ] **Video pins:** only image uploads are handled.
- [ ] **Board sections, collaborators and archive** are not supported.
- [ ] **Pin page cosmetics:** there are two back arrows, and a "Find it. Love it.
  Save it." extension promo appears after publishing.
- [ ] **Link to Pinterest settings tab** is empty. It's a business feature;
  consider hiding it.
- [ ] **HTTPS** isn't set up on the live box; README step 2 covers how. Several
  client features improve with it.
- [ ] **`/v3/pins/:pin/save/`**: plain form posts work, but check what the
  client really sends when saving to a board from the grid.

## Conventions

- ES modules, 2-space indent, single quotes, semicolons. Keep files small and
  focused, with a short comment at the top saying what the file is for.
- Handlers get a `ctx` and return data. Throw `badRequest`, `forbidden` or
  `notFound` from `src/util/errors.js`. Never write to `res` from an endpoint.
- Clamp user text with `clean(value, LIMITS.x)` from `src/util/text.js` and
  `src/config.js`.
- Import from `src/database/index.js` and `src/schemas/index.js`, not from
  individual model files. That keeps paths stable.
- **Import cycles plus top-level `await` deadlock silently** (the process exits
  0 and prints nothing). The route registry imports every route at startup, so
  route and resource files must never import `src/api/core/registry.js` or
  `core/v3.js`. `ApiResource` gets the dispatcher through `ctx.callV3` for this
  reason.
- Commit messages: an imperative subject and a body explaining why. Push to
  `main`. CI runs `npm run check`, `npm test` and `npm run test:e2e`.
