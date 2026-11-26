// The object every endpoint handler receives.
import { currentUserId } from '../../database/index.js';

export function createContext({ req, res, url, params = {}, data = {}, options = {}, bookmark = null, method }) {
  return {
    req,
    res,
    url,
    origin: url.origin,
    params,
    /** Request payload (query + body, or the tunnelled v3 `data`). */
    data,
    /** Resource options (for /resource/ calls). */
    options,
    bookmark,
    /** get | create | update | delete for resources; HTTP verb for v3. */
    method,
    /** Response metadata a handler may set. */
    meta: { bookmark: null, auxData: {} },
    get userId() { return currentUserId(); },
  };
}
