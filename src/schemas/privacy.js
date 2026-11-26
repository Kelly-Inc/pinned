// Sections shown on Settings -> Privacy and data. Values come from the
// user's stored settings (by field name) and fall back to these defaults.
const field = (name, label, description, value = true) => ({
  id: name,
  name,
  label_desktop: `${label}: ${description}`,
  label_mobile: label,
  header_mobile: description,
  value,
  is_inverted_value: false,
});

export const PRIVACY_SECTIONS = [
  {
    id: 'privacy',
    title: 'Privacy',
    description: ['Control who can see and interact with your profile.'],
    settings_field: [
      field('hide_from_search_engines', 'Search privacy', 'Hide your profile from search engines', false),
      field('allow_mentions', 'Mentions', 'Allow people to @mention you in comments and descriptions'),
    ],
  },
  {
    id: 'personalization',
    title: 'Personalization',
    description: ['Data used to tailor your feed on this instance.'],
    settings_field: [
      field('use_activity_for_recommendations', 'Use your activity', 'Use the Pins you save, like and create to tailor your home feed'),
    ],
  },
];

// The settings form compares edits against the keys present on the viewer.
export const PRIVACY_DEFAULTS = Object.fromEntries(PRIVACY_SECTIONS.flatMap(
  (section) => section.settings_field.map((field) => [field.name, field.value]),
));
