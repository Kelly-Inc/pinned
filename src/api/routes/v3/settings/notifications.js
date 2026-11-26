// Settings -> Notifications: categories of per-channel switches.
import { getSetting, setSetting } from '../../../../database/index.js';
import { notificationSettingsShape, prefKey } from '../../../../schemas/index.js';
import { parseJson, parseList } from '../../../../util/json.js';

const prefs = () => parseJson(getSetting('notification_prefs', '{}'), {}) || {};

export const get = () => notificationSettingsShape(prefs());

export function post(ctx) {
  const next = prefs();
  for (const change of parseList(ctx.data.updated_settings)) {
    next[prefKey(change.section, change.option, change.type)] = !!change.value;
  }
  setSetting('notification_prefs', JSON.stringify(next));
  return {};
}
