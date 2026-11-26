// Search suggestions carry a display label and the local results URL to open.
import { suggestPinTitles } from '../../database/index.js';

export function get({ options }) {
  const query = String(options.term || '');
  const term = query.trim();
  const limit = Math.max(0, Math.min(25, Math.trunc(Number(options.count ?? 5)) || 0));
  const scope = options.pin_scope || 'pins';
  const items = [];
  if (term && limit && !options.board && ['pins', 'my_pins'].includes(scope)) {
    const titles = suggestPinTitles(term, limit, { ownPins: scope === 'my_pins' });
    for (const { title } of titles) {
      const params = new URLSearchParams({ q: title });
      items.push({ type: 'query', id: title, label: title, query: title, url: `/search/${scope}/?${params}` });
    }
  }
  return { items, query };
}
