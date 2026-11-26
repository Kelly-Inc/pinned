import {
  conversationMessages, markConversationRead, sendConversationMessage,
} from '../../database/index.js';
import { messageShape } from '../../schemas/index.js';

export function get(ctx) {
  const id = String(ctx.options.conversation_id || '');
  const limit = Math.max(1, Math.min(Math.trunc(Number(ctx.options.page_size)) || 25, 100));
  const cursor = Number(ctx.bookmark);
  const before = cursor > 0 && Number.isSafeInteger(cursor) ? cursor : undefined;
  const rows = conversationMessages(id, { limit: limit + 1, before });
  const page = rows.slice(0, limit);
  if (!before && page.length) markConversationRead(id, page[0].id);
  if (rows.length > limit) ctx.meta.bookmark = String(page.at(-1).id);
  return page.map((message) => messageShape(message, ctx.origin));
}

export function create({ data, origin }) {
  return messageShape(sendConversationMessage(String(data.conversation_id || ''), data), origin);
}
