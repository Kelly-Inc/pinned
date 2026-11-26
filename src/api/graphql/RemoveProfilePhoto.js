// "Remove photo" in Edit profile.
import { removeAvatar } from '../../cdn/avatars.js';
import { getSettings } from '../../database/index.js';

export const match = /RemoveProfilePhoto/i;
export const priority = 100;

export function resolve() {
  removeAvatar();
  return { v3EditSettingsHandler: { __typename: 'V3EditSettingsHandlerAssociatedResponse', data: getSettings() } };
}
