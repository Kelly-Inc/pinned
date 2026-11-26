// Ordered list of migrations. Append new ones; never edit applied ones.
import m0001 from './0001_core_tables.js';
import m0002 from './0002_accounts.js';
import m0003 from './0003_follows.js';
import m0004 from './0004_profile_fields.js';
import m0005 from './0005_uploads.js';
import m0006 from './0006_indexes.js';
import m0007 from './0007_pin_favorites.js';

export const migrations = [m0001, m0002, m0003, m0004, m0005, m0006, m0007];
