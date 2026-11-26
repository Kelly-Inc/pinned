import { getSettings, me, extraSettings } from '../database/index.js';
import { userShape } from './user.js';

/** What the settings pages read: public profile + editable settings. */
export function viewerShape(origin) {
  const user = me();
  const pronouns = extraSettings(user).pronouns;
  return {
    ...userShape(user, origin),
    ...getSettings(user.id),
    pronouns: Array.isArray(pronouns) ? pronouns : [],
    account_type: 'personal',
    profile_image: userShape(user, origin).image_medium_url,
    country: 'US',
    locale: 'en_US',
    is_tester: false,
  };
}
