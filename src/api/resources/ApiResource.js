// The client tunnels most v3 REST calls through this resource:
//   options = { url: "/v3/...", data: {...} }
// It runs the same route table as direct /v3 requests. (The dispatcher comes
// in on ctx to avoid an import cycle with the route registry.)
import { parseJson } from '../../util/json.js';

const VERB = { get: 'GET', create: 'POST', update: 'PUT', delete: 'DELETE' };

function tunnel(ctx) {
  return ctx.callV3({
    req: ctx.req,
    res: ctx.res,
    url: ctx.url,
    verb: VERB[ctx.method] || 'GET',
    pathname: String(ctx.options.url || ''),
    data: parseJson(ctx.options.data, {}) || {},
  });
}

export const get = tunnel;
export const create = tunnel;
export const update = tunnel;
export const remove = tunnel;
