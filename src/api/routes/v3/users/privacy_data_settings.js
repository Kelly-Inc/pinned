// Settings -> Privacy and data. Field values come from stored settings.
import { getSettings } from '../../../../database/index.js';
import { PRIVACY_SECTIONS } from '../../../../schemas/index.js';

export function get() {
  const settings = getSettings();
  return PRIVACY_SECTIONS.map((section) => ({
    ...section,
    settings_field: section.settings_field.map((f) => ({ ...f, value: settings[f.name] ?? f.value })),
  }));
}
