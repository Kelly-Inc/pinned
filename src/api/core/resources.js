// Dispatch for /resource/<Name>/<method>/ calls.
import { resources } from './registry.js';
import { callV3 } from './v3.js';
import { createContext } from './context.js';
import { resourceQuery, parseBody } from './request.js';
import { resourceEnvelope } from '../../schemas/index.js';

export async function handleResource(req, res, url, name, method) {
  const query = resourceQuery(url);
  const body = req.method === 'POST' ? await parseBody(req) : {};
  // Options: query string for GETs, body for POSTs (which can also be "get").
  const options = body.options && Object.keys(body.options).length ? body.options : query.options;
  const module = resources.get(name);
  const handler = module && module[method === 'delete' ? 'remove' : method];
  const ctx = createContext({
    req, res, url, data: { ...options, ...body }, options, bookmark: query.bookmark, method,
  });
  ctx.resourceName = name;
  ctx.callV3 = callV3;
  let data;
  if (handler) data = await handler(ctx);
  else data = method === 'get' ? [] : {};
  return resourceEnvelope(name, data, {
    options,
    method,
    bookmark: ctx.meta.bookmark,
    auxData: ctx.meta.auxData,
  });
}
