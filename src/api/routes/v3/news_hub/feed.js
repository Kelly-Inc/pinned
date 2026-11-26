// Activity on the viewer's profile and Pins.
import { listActivity } from '../../../../database/index.js';

export function get({ data }) {
  const limit = Math.max(1, Math.min(Math.trunc(Number(data.page_size)) || 20, 100));
  return listActivity(limit).map((item) => {
    const isFollow = item.kind === 'follow';
    const text = `${item.full_name || item.username} ${isFollow ? 'followed you' : 'commented on your Pin'}`;
    return {
      id: String(item.id),
      type: 'news',
      unread: !!item.unread,
      last_updated_at: item.created_at,
      title_text: text,
      content_text: text,
      content_items: [],
      subscribable_objects: [],
      override_click_url: isFollow ? `/${item.username}/` : `/pin/${item.pin_id}/`,
    };
  });
}
