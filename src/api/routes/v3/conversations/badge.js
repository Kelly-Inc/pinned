import { clearConversationBadge } from '../../../../database/index.js';

export function del() {
  clearConversationBadge();
  return {};
}
