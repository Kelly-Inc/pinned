// Recipient search used by the inbox and local share menus.
import { searchMessageRecipients } from '../../database/index.js';
import { userShape } from '../../schemas/index.js';
import { clean } from '../../util/text.js';

export function get({ options, origin }) {
  const term = clean(options.term ?? options.query, 100);
  const limit = Math.max(1, Math.min(Math.trunc(Number(options.count)) || 25, 50));
  const items = term ? searchMessageRecipients(term, limit).map((user) => userShape(user, origin)) : [];
  return { items };
}
