import { addColumn } from '../connection.js';

// Editable profile fields plus a JSON bag for every other settings toggle.
export default {
  id: '0004_profile_fields',
  up() {
    addColumn('users', 'first_name', "TEXT NOT NULL DEFAULT ''");
    addColumn('users', 'last_name', "TEXT NOT NULL DEFAULT ''");
    addColumn('users', 'about', "TEXT NOT NULL DEFAULT ''");
    addColumn('users', 'website_url', "TEXT NOT NULL DEFAULT ''");
    addColumn('users', 'settings', "TEXT NOT NULL DEFAULT '{}'");
  },
};
