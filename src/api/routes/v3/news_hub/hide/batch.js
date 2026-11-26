// Hide or restore selected Updates for the viewer.
import { hideActivity } from '../../../../../database/index.js';
import { parseList } from '../../../../../util/json.js';

export function put({ data }) {
  const ids = parseList(data.news_ids).map(String).filter((id) => /^\d+$/.test(id));
  hideActivity(ids, data.should_hide === true || data.should_hide === 'true');
  return {};
}
