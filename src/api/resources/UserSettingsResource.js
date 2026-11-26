// Account settings (Edit profile, Account management, toggles everywhere).
import { getSettings, updateSettings } from '../../database/index.js';

export const get = () => getSettings();
export const update = (ctx) => updateSettings(ctx.data);
export const create = update;
