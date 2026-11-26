// Dispatch for v3 REST calls, both direct (/v3/..., /api/...) and tunnelled
// through ApiResource. Handlers return data; transport wrapping happens here.
import { v3 } from './registry.js';
import { Router } from './router.js';
import { createContext } from './context.js';
import { fallback } from './fallback.js';

/** Run a v3 endpoint and return its data. */
export async function callV3({ req, res, url, verb, pathname, data }) {
  const found = v3.match(pathname);
  const handler = found && Router.handler(found.route.module, verb);
  if (!handler) return fallback(verb, pathname, data);
  const ctx = createContext({ req, res, url, params: found.params, data, method: verb });
  return handler(ctx);
}
