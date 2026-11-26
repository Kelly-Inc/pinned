// The notification settings page: categories -> subcategories -> per-channel
// switches. Preferences are stored as "category.subcategory.channel" keys.
export const ACTIVITY_PREFERENCES = {
  follow: ['social', 'followers'],
  comment: ['activity', 'comments'],
};

export const CHANNELS = [['push', 'Push'], ['email', 'Email']];

export const CATEGORIES = [
  ['activity', 'Activity on your Pins and boards', [
    ['comments', 'Comments', 'When someone comments on your Pins'],
    ['reactions', 'Reactions', 'When someone likes your Pins'],
    ['saves', 'Saves', 'When someone saves your Pins'],
  ]],
  ['social', 'Your network', [
    ['followers', 'New followers', 'When someone follows you'],
    ['following_pins', 'Pins from people you follow', 'When people you follow publish new Pins'],
  ]],
];

export const prefKey = (category, subcategory, channel) => `${category}.${subcategory}.${channel}`;

export function notificationSettingsShape(prefs) {
  return CATEGORIES.map(([key, label, subs]) => ({
    key,
    label,
    subcategories: subs.map(([subKey, subLabel, description]) => {
      const hasInApp = Object.values(ACTIVITY_PREFERENCES).some(
        ([category, subcategory]) => category === key && subcategory === subKey,
      );
      const channels = hasInApp ? [...CHANNELS, ['news', 'In-app']] : CHANNELS;
      const options = channels.map(([channel, channelLabel]) => ({
        channel,
        label: channelLabel,
        category_key: key,
        subcategory_key: subKey,
        value: prefs[prefKey(key, subKey, channel)] ?? true,
      }));
      const enabled = options.filter((o) => o.value).map((o) => o.label);
      return {
        key: subKey,
        label: subLabel,
        description,
        channel_options: options,
        channel_options_label: enabled.length ? enabled.join(', ') : 'Off',
      };
    }),
  }));
}
