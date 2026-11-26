// Sections shown on Settings -> Privacy and data. Values come from the
// user's stored settings (by field name) and fall back to these defaults.
const field = (name, label, description, value = false, inverted = false) => ({
  id: name,
  name,
  label_desktop: `${label}: ${description}`,
  label_mobile: label,
  header_mobile: description,
  link_text: 'Learn more',
  link_url: 'https://help.pinterest.com/en/article/your-privacy-and-data-settings',
  value,
  is_inverted_value: inverted,
});

export const PRIVACY_SECTIONS = [
  {
    id: 'ads_personalization',
    title: 'Ads personalization',
    settings_field: [
      field('personalize_from_offsite_browsing', 'Use info from sites you visit', 'Use activity from other sites to personalize ads'),
      field('ads_customize_from_conversion', 'Use of partner info', 'Use information from partners to personalize ads'),
      field('third_party_marketing_tracking_enabled', 'Ads about Pinterest', 'Use activity here to personalize ads about Pinterest elsewhere'),
      field('ccpa_opted_out', 'Activity for ads reporting', 'Share activity with advertisers to measure ad performance', true, true),
      field('third_party_ads_personalization', 'Sharing info with partners', 'Use partner sharing to personalize ads shown here'),
      field('third_party_ads_off_pinterest_enabled', 'Ads off Pinterest', 'Share information with partners to personalize ads on other sites'),
    ],
  },
  {
    id: 'generative_ai',
    title: 'Generative AI settings',
    settings_field: [
      field('opt_out_gen_ai_model_training', 'Use data for model training', 'Allow public Pins to be used to train generative AI models', true, true),
    ],
  },
];

// The settings form compares edits against the keys present on the viewer.
export const PRIVACY_DEFAULTS = Object.fromEntries(PRIVACY_SECTIONS.flatMap(
  (section) => section.settings_field.map((field) => [field.name, field.value]),
));
