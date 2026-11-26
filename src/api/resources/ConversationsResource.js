import { listConversations, startConversation } from '../../database/index.js';
import { conversationShape } from '../../schemas/index.js';
import { parseList } from '../../util/json.js';
import { badRequest } from '../../util/errors.js';

export function get({ options, origin }) {
  const limit = Math.max(1, Math.min(Math.trunc(Number(options.page_size)) || 50, 100));
  return listConversations(limit).map((conversation) => conversationShape(conversation, origin));
}

export function create({ data, origin }) {
  if (parseList(data.emails).length) throw badRequest('Messages can only be sent to local accounts');
  return conversationShape(startConversation(parseList(data.user_ids), data), origin);
}
