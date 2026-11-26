// Badge count for the Updates panel.
import { unreadActivityCount, unseenConversationCount } from '../../database/index.js';

export const get = () => ({ news_hub_count: unreadActivityCount(), conversations_unseen_count: unseenConversationCount() });
