// Sections shown on Settings -> Privacy and data. Values come from the
// user's stored settings (by field name) and fall back to these defaults.
const field = (name, label, description, value = true) => ({ name, label, description, value, is_inverted_value: false });

export const PRIVACY_SECTIONS = [
  {
    title: 'Privacy',
    description: 'Control who can see and interact with your profile.',
    settings_field: [
      field('hide_from_search_engines', 'Search privacy', 'Hide your profile from search engines', false),
      field('allow_mentions', 'Mentions', 'Allow people to @mention you in comments and descriptions'),
    ],
  },
  {
    title: 'Personalization',
    description: 'Data used to tailor your feed on this instance.',
    settings_field: [
      field('use_activity_for_recommendations', 'Use your activity', 'Use the Pins you save, like and create to tailor your home feed'),
    ],
  },
];
