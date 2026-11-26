// Entry point for every API request. Routes to the resource, v3, GraphQL or
// misc handlers and turns errors into the response format the caller expects.
import { handleResource } from './core/resources.js';
import { handleGraphql } from './core/graphql.js';
import { callV3 } from './core/v3.js';
import { parseBody } from './core/request.js';
import { sendJson } from '../util/http.js';
import { HttpError } from '../util/errors.js';
import { resourceError } from '../schemas/index.js';
import { currentUserId } from '../database/index.js';
import { log } from '../util/logger.js';

const RESOURCE = /^\/resource\/([A-Za-z0-9_]+)\/(get|create|update|delete)\/?$/;

export function isApiPath(pathname) {
  return pathname.startsWith('/resource/') || pathname.startsWith('/v3/') || pathname.startsWith('/_/')
    || pathname.startsWith('/api/') || pathname.startsWith('/refresh');
}

export async function handleApi(req, res, url) {
  const { pathname } = url;
  const resource = RESOURCE.exec(pathname);
  try {
    if (resource) return sendJson(res, await handleResource(req, res, url, resource[1], resource[2]));
    if (pathname === '/_/graphql/' || pathname === '/_/graphql') return sendJson(res, await handleGraphql(req, res, url));
    if (pathname.startsWith('/v3/') || pathname.startsWith('/api/')) {
      const v3Path = pathname.startsWith('/api/') ? `/v3/${pathname.slice(5)}` : pathname;
      const data = { ...Object.fromEntries(url.searchParams), ...(await parseBody(req)) };
      return sendJson(res, await callV3({ req, res, url, verb: req.method, pathname: v3Path, data }));
    }
    if (pathname.startsWith('/refresh')) return sendJson(res, { ok: true, csrf_token: 'local', user_id: currentUserId() });
    return sendJson(res, pathname.startsWith('/_/') ? {} : { ok: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) log.error('api error', pathname, error);
    const message = status === 500 ? 'Internal error' : error.message;
    if (resource) return sendJson(res, resourceError(resource[1], status, message, resource[2]), status);
    return sendJson(res, { status: 'failure', code: status, message }, status);
  }
}
