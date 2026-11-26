// Badge count for the Updates panel.
import { unreadActivityCount } from '../../database/index.js';

export const get = () => ({ news_hub_count: unreadActivityCount() });
