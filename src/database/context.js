// Who is making the current request. Set once per request by the server, read
// anywhere below it without threading a user id through every call.
import { AsyncLocalStorage } from 'node:async_hooks';
import { unauthorized } from '../util/errors.js';

export const requestUser = new AsyncLocalStorage();

/** Run fn as the given user. */
export function runAs(userId, fn) {
  return requestUser.run(String(userId), fn);
}

/** The id of the logged-in user, or throws 401. */
export function currentUserId() {
  const id = requestUser.getStore();
  if (!id) throw unauthorized();
  return id;
}

/** The id of the logged-in user, or null. */
export function maybeCurrentUserId() {
  return requestUser.getStore() || null;
}
