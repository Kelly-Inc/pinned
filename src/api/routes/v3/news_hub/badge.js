// Opening Updates clears the viewer's badge.
import { clearActivityBadge } from '../../../../database/index.js';

export function del() {
  clearActivityBadge();
  return {};
}
