import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('a private conversation persists messages, pin shares and per-member read state', async () => {
  const sender = await new Client(server.url).signup();
  const recipient = await new Client(server.url).signup();
  const stranger = await new Client(server.url).signup();

  const thread = await sender.resource('ConversationsResource', { user_ids: [recipient.id], text: 'Hello' }, 'create');
  const conversation = { conversation_id: thread.id };
  assert.equal(thread.last_message.text, 'Hello');
  assert.equal(thread.unread, 0);

  const pin = await sender.publishPin();
  const shared = await sender.resource('ConversationMessagesResource', { ...conversation, pin: pin.id }, 'create');
  assert.equal(shared.pin.id, pin.id);
  const badge = async (client) => (await client.resource('NewsHubBadgeResource')).conversations_unseen_count;
  assert.equal(await badge(sender), 0);
  assert.equal(await badge(recipient), 1);
  assert.deepEqual(await stranger.resource('ConversationsResource'), []);
  assert.equal((await recipient.resource('ConversationsResource'))[0].unread, 2);
  await recipient.api('delete', '/v3/conversations/badge/');
  assert.equal(await badge(recipient), 0);
  assert.equal((await recipient.api('get', `/v3/conversations/${thread.id}/`)).unread, 2);

  await assert.rejects(stranger.resource('ConversationMessagesResource', conversation), { status: 404 });
  await assert.rejects(stranger.resource('ConversationMessagesResource', { ...conversation, text: 'intrusion' }, 'create'), { status: 404 });
  await assert.rejects(stranger.api('get', `/v3/conversations/${thread.id}/`), { status: 404 });

  const endpoint = '/resource/ConversationMessagesResource/get/';
  const data = encodeURIComponent(JSON.stringify({ options: { ...conversation, page_size: 1 } }));
  const first = (await (await recipient.raw(`${endpoint}?data=${data}`)).json()).resource_response;
  assert.equal(first.data[0].id, shared.id);
  assert.equal(first.bookmark, shared.id);
  const previous = (await (await recipient.raw(`${endpoint}?data=${data}&bookmark=${first.bookmark}`)).json()).resource_response;
  assert.equal(previous.data[0].text, 'Hello');
  assert.equal(previous.bookmark, null);
  assert.equal((await recipient.resource('ConversationsResource'))[0].unread, 0);
  const reply = await recipient.resource('ConversationsResource', { user_ids: [sender.id], text: 'Hi back' }, 'create');
  assert.equal(reply.id, thread.id);
  assert.equal(await badge(sender), 1);
});

test('recipient search matches local names and excludes the viewer and private credentials', async () => {
  const viewer = await new Client(server.url).signup(undefined, undefined, 'Local Spring');
  const recipient = await new Client(server.url).signup(undefined, undefined, 'Local Summer');
  const { items: suggestions } = await viewer.resource('ShareSuggestionsTypeaheadResource', { term: 'local' });
  assert.deepEqual(suggestions.map(({ id }) => id), [recipient.id]);
  assert.equal(suggestions[0].email, undefined);
  assert.equal(suggestions[0].password_hash, undefined);
});
