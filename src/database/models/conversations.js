// Keep conversation reads, writes and notification state scoped to members.
import { db, transaction } from '../connection.js';
import { currentUserId } from '../context.js';
import { getUser } from './users.js';
import { getPin } from './pins.js';
import { newId } from '../../util/ids.js';
import { badRequest, notFound } from '../../util/errors.js';
import { clean } from '../../util/text.js';
import { LIMITS } from '../../config.js';

export function getConversation(id) {
  const conversation = db.prepare(`
    SELECT c.*, m.last_read FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    WHERE c.id = ? AND m.user_id = ?
  `).get(String(id), currentUserId());
  if (!conversation) throw notFound('Conversation not found');
  return conversation;
}

export function conversationMembers(id) {
  getConversation(id);
  return db.prepare(`
    SELECT u.* FROM conversation_members m JOIN users u ON u.id = m.user_id
    WHERE m.conversation_id = ? ORDER BY u.id
  `).all(id);
}

export function listConversations(limit) {
  return db.prepare(`
    SELECT c.*, m.last_read FROM conversations c
    JOIN conversation_members m ON m.conversation_id = c.id
    JOIN conversation_messages msg ON msg.id = (
      SELECT max(id) FROM conversation_messages WHERE conversation_id = c.id
    )
    WHERE m.user_id = ? ORDER BY msg.id DESC LIMIT ?
  `).all(currentUserId(), limit);
}

function messageFields(text, pin) {
  const body = clean(text, LIMITS.messageChars);
  const pinId = pin ? getPin(pin)?.id : null;
  if (pin && !pinId) throw notFound('Pin not found');
  return { body, pinId };
}

function insertMessage(id, { body, pinId }) {
  return db.prepare(`
    INSERT INTO conversation_messages (conversation_id, sender_id, text, pin_id)
    VALUES (?, ?, ?, ?) RETURNING *
  `).get(id, currentUserId(), body, pinId);
}

export function startConversation(recipients, { text, pin }) {
  const viewer = currentUserId();
  const users = Array.from(new Set([viewer, ...recipients.map(String)])).sort();
  if (users.length < 2 || users.length > 20 || users.some((id) => !getUser(id)?.password_hash)) {
    throw badRequest('Choose between 1 and 19 local recipients');
  }
  const message = messageFields(text, pin);
  return transaction(() => {
    const key = JSON.stringify(users);
    let conversation = db.prepare('SELECT id FROM conversations WHERE participant_key = ?').get(key);
    if (!conversation) {
      conversation = { id: newId() };
      db.prepare('INSERT INTO conversations (id, participant_key) VALUES (?, ?)').run(conversation.id, key);
      const add = db.prepare('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)');
      for (const id of users) add.run(conversation.id, id);
    }
    if (message.body || message.pinId) insertMessage(conversation.id, message);
    return getConversation(conversation.id);
  });
}

export function sendConversationMessage(id, { text, pin }) {
  getConversation(id);
  const message = messageFields(text, pin);
  if (!message.body && !message.pinId) throw badRequest('Message is empty');
  return insertMessage(id, message);
}

export function conversationMessages(id, { limit, before = Number.MAX_SAFE_INTEGER }) {
  getConversation(id);
  return db.prepare(`
    SELECT * FROM conversation_messages WHERE conversation_id = ? AND id < ?
    ORDER BY id DESC LIMIT ?
  `).all(id, before, limit);
}

export function unreadConversationMessages(id, lastRead) {
  return db.prepare(`
    SELECT count(*) AS count FROM conversation_messages
    WHERE conversation_id = ? AND sender_id != ? AND id > ?
  `).get(id, currentUserId(), lastRead).count;
}

export function markConversationRead(id, through) {
  const user = currentUserId();
  db.prepare(`
    UPDATE conversation_members SET last_read = max(last_read, ?), last_seen = max(last_seen, ?)
    WHERE conversation_id = ? AND user_id = ?
  `).run(through, through, id, user);
}

export function unseenConversationCount() {
  return db.prepare(`
    SELECT count(*) AS count FROM conversation_members member WHERE user_id = ?
      AND EXISTS (SELECT 1 FROM conversation_messages msg
        WHERE msg.conversation_id = member.conversation_id
          AND msg.id > member.last_seen AND msg.sender_id != member.user_id)
  `).get(currentUserId()).count;
}

export function clearConversationBadge() {
  db.prepare(`
    UPDATE conversation_members AS member SET last_seen = coalesce((
      SELECT max(id) FROM conversation_messages WHERE conversation_id = member.conversation_id
    ), 0) WHERE user_id = ?
  `).run(currentUserId());
}
