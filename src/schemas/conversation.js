import {
  conversationMembers, conversationMessages, getPin, getUser, unreadConversationMessages,
} from '../database/index.js';
import { userShape } from './user.js';
import { pinShape } from './pin.js';

export function messageShape(message, origin) {
  if (!message) return null;
  return {
    id: String(message.id),
    type: 'conversationmessage',
    conversation_id: message.conversation_id,
    message_type: message.pin_id ? 9 : 0,
    text: message.text,
    created_at: message.created_at,
    created_ms: Date.parse(message.created_at),
    sender: userShape(getUser(message.sender_id), origin),
    pin: message.pin_id ? pinShape(getPin(message.pin_id), { origin, withBoard: false }) : null,
  };
}

export function conversationShape(conversation, origin) {
  const { id, created_at, last_read } = conversation;
  return {
    id,
    created_at,
    type: 'conversation',
    users: conversationMembers(id).map((user) => userShape(user, origin)),
    emails: [],
    unread: unreadConversationMessages(id, last_read),
    last_message: messageShape(conversationMessages(id, { limit: 1 })[0], origin),
  };
}
