# Architecture

Pinned serves the Pinterest web client (`vendor/`) and implements the
backend it talks to. The client thinks it is talking to Pinterest; every
request lands here instead.

```
browser ──► src/server/app.js  (request pipeline)
              1. static files      src/server/static.js   vendor code, uploads, avatars, assets
              2. redirects         /search -> /search/pins/
              3. auth pages        src/auth/              /login /signup /logout
              4. session           cookie -> user, then everything runs "as" that user
              5. uploads           src/cdn/               pin images, profile photos
              6. API               src/api/               resources, v3 REST, GraphQL
              7. app shell         src/client/shell/      the HTML that boots the client
```

## Layout

| Path | What lives there |
|---|---|
| `server.js` | Entry point. Calls `start()`. |
| `src/config.js` | Every setting, from environment variables. |
| `src/server/` | HTTP server, request pipeline, static files, shutdown. |
| `src/auth/` | Password hashing, sign up / log in, the login page, auth routes. |
| `src/api/core/` | Routers and dispatch: file-system v3 router, resource dispatcher, GraphQL, request parsing. |
| `src/api/routes/v3/` | **One file per v3 endpoint.** The path is the URL. |
| `src/api/resources/` | **One file per Pinterest "resource"** (`/resource/<Name>/<method>/`). |
| `src/api/graphql/` | One file per GraphQL operation the client sends. |
| `src/database/` | SQLite connection, request user context, migrations, one model per table. |
| `src/schemas/` | Turn database rows into the exact JSON shapes the client expects. |
| `src/cdn/` | Storing uploaded images and avatars, generated initial avatars. |
| `src/client/` | Building the app shell, rewriting vendored code, injected browser scripts and CSS. |
| `src/jobs/` | Periodic housekeeping (expired sessions). |
| `src/util/` | Small shared helpers: HTTP, errors, bodies, cookies, images, multipart, ids, logging. |
| `tests/api/` | API tests against a real server and throwaway database. |
| `tests/e2e/` | Browser tests driving the real client in headless Chromium. |
| `tools/` | Developer scripts (route listing, import checks, vendoring the client). |

## Three ways the client calls the API

1. **Resources**: `GET /resource/BoardResource/get/?data={"options":{...}}`, or
   `POST /resource/BoardResource/create/` with a form-encoded `data=` body. Handled by
   `src/api/resources/<Name>.js`, which exports `get`, `create`, `update` and `remove`.
   Responses are wrapped in `resource_response` by `src/schemas/envelope.js`.
2. **v3 REST**: `/v3/pins/123/react/`. Most calls are actually tunnelled through
   `ApiResource` with `options = { url, data }`. Both forms run the same route file
   in `src/api/routes/v3/`.
3. **GraphQL**: `POST /_/graphql/` with an `x-pinterest-graphql-name` header. Matched
   by name against `src/api/graphql/*.js`.

## Adding an endpoint

Create a file whose path is the URL. Folders starting with `#` are parameters:

```js
// src/api/routes/v3/pins/#pin/react.js  ->  /v3/pins/:pin/react/
import { getPin, setLike } from '../../../../../database/index.js';
import { pinShape } from '../../../../../schemas/index.js';
import { notFound } from '../../../../../util/errors.js';

export function post(ctx) {
  if (!setLike(ctx.params.pin, true)) throw notFound('Pin not found');
  return pinShape(getPin(ctx.params.pin), { origin: ctx.origin });
}
export function del(ctx) { /* DELETE */ }
```

Handlers get a `ctx` (`params`, `data`, `options`, `origin`, `userId`, `meta`) and
return plain data. Throw `HttpError`s (`badRequest`, `forbidden`, `notFound`...) for
failures. Static segments beat parameters, so `/v3/users/me/` wins over
`/v3/users/:user/`. Run `npm run routes` to see the full table.

To find out what the client calls that isn't implemented yet, run with
`PINNED_LOG_LEVEL=debug` and look for `[v3 unhandled]` lines.

## Database

`src/database/migrations/` holds numbered migrations, applied in order at startup
and recorded in `schema_migrations`. They're idempotent, so databases created
before migrations existed upgrade cleanly. **Never edit a migration that has
shipped; add a new one.**

Models in `src/database/models/` read the current user from an
`AsyncLocalStorage` context (`currentUserId()`), set once per request. Ownership
checks (`ownPin`, `ownBoard`, `ownUpload`) live in the models, so no endpoint can
forget them.

## The app shell

`data/pinterest_home.html` is a captured Pinterest page. For each user,
`src/client/shell/` rewrites it to:

- load the client from this server (versioned `/webapp/_v…/` paths, so restarts bust caches);
- boot as the logged-in user (`context.js`);
- strip the logged-out server render (`ssr.js`);
- inject the theme loader, the link fixer and CSS fixes (`src/client/inject/`).

`src/client/vendor.js` rewrites vendored code as it's served, so in-app links to
`www.pinterest.com/settings`, `/pin/…` and so on stay on this server.

## Tests

```bash
npm test          # API tests: real server, throwaway database
npm run test:e2e  # browser tests (needs Chromium for playwright-core)
npm run check     # every relative import resolves
```
