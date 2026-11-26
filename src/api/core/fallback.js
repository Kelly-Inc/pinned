// Responses for v3 endpoints we have no route for. Lists the client expects
// as arrays get [], everything else {}. Set PINNED_LOG_LEVEL=debug to see them.
import { log } from '../../util/logger.js';

const LIST_HINTS = ['contact_requests', 'board_title_suggestions', '/suggestions', '/recommendations'];

export function fallback(method, pathname, data) {
  log.debug(`[v3 unhandled] ${method} ${pathname} ${JSON.stringify(data).slice(0, 300)}`);
  if (method === 'GET' && LIST_HINTS.some((hint) => pathname.includes(hint))) return [];
  return {};
}
