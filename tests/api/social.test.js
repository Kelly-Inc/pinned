import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('liking persists, is idempotent and shows after a reload', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const pin = await a.publishPin();
  await b.api('create', `/v3/pins/${pin.id}/react/`, { reaction_type: 1 });
  await b.api('create', `/v3/pins/${pin.id}/react/`, { reaction_type: 1 });
  const fresh = await b.resource('PinResource', { id: pin.id });
  assert.equal(fresh.like_count, 1);
  assert.equal(fresh.reaction_by_me, 1);
  const forOwner = await a.resource('PinResource', { id: pin.id });
  assert.equal(forOwner.reaction_by_me, 0);
  await b.api('delete', `/v3/pins/${pin.id}/react/`);
  const after = await b.resource('PinResource', { id: pin.id });
  assert.equal(after.like_count, 0);
  assert.equal(after.reaction_by_me, 0);
});

test('liking also works on the direct v3 endpoint', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin();
  const res = await c.raw(`/v3/pins/${pin.id}/react/`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal((await c.resource('PinResource', { id: pin.id })).like_count, 1);
});

test('liking a missing pin is a 404', async () => {
  const c = await new Client(server.url).signup();
  await assert.rejects(c.api('create', '/v3/pins/999999/react/', {}), { status: 404 });
});

test('comments: create, count, list and delete with permissions', async () => {
  const owner = await new Client(server.url).signup();
  const author = await new Client(server.url).signup();
  const stranger = await new Client(server.url).signup();
  const pin = await owner.publishPin();
  const comment = await author.resource('AggregatedCommentResource', { pinId: pin.id, text: 'nice pin' }, 'create');
  assert.equal(comment.text, 'nice pin');
  assert.equal(comment.user.username, author.username);
  assert.equal((await owner.resource('PinResource', { id: pin.id })).comment_count, 1);
  const list = await owner.resource('UnifiedCommentsResource', { pin_id: pin.id });
  assert.equal(list.results.length, 1);
  await assert.rejects(stranger.resource('AggregatedCommentResource', { commentId: comment.id }, 'delete'), { status: 403 });
  await owner.resource('AggregatedCommentResource', { commentId: comment.id }, 'delete');
  assert.equal((await owner.resource('PinResource', { id: pin.id })).comment_count, 0);
});

test('empty comments are rejected', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin();
  await assert.rejects(c.resource('AggregatedCommentResource', { pinId: pin.id, text: '   ' }, 'create'), { status: 400 });
});

test('saves count as repins only for other people', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const pin = await a.publishPin();
  await b.resource('RepinResource', { pin_id: pin.id }, 'create');
  const seen = await a.resource('PinResource', { id: pin.id });
  assert.equal(seen.repin_count, 1);
  assert.equal((await b.resource('PinResource', { id: pin.id })).is_saved, true);
});

test('follow and unfollow update real counts', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  await a.raw(`/v3/users/${b.username}/follow/`, { method: 'PUT' });
  let bView = await a.resource('UserResource', { username: b.username });
  assert.equal(bView.follower_count, 1);
  assert.equal(bView.explicitly_followed_by_me, true);
  assert.equal((await a.resource('UserResource', { username: a.username })).following_count, 1);
  const following = await a.resource('UserFollowingResource', { username: a.username });
  assert.deepEqual(following.map((u) => u.username), [b.username]);
  const followers = await a.resource('UserFollowersResource', { username: b.username });
  assert.deepEqual(followers.map((u) => u.username), [a.username]);
  await a.raw(`/v3/users/${b.username}/follow/`, { method: 'DELETE' });
  bView = await a.resource('UserResource', { username: b.username });
  assert.equal(bView.follower_count, 0);
});

test('you cannot follow yourself', async () => {
  const c = await new Client(server.url).signup();
  await c.raw(`/v3/users/${c.username}/follow/`, { method: 'PUT' });
  assert.equal((await c.resource('UserResource', { username: c.username })).following_count, 0);
});

test('the Updates feed sends an empty list to a new account', async () => {
  const c = await new Client(server.url).signup();
  assert.deepEqual(await c.api('get', '/v3/news_hub/feed/'), []);
});

test('follows and comments create private Updates with a clearable badge', async () => {
  const owner = await new Client(server.url).signup();
  const actor = await new Client(server.url).signup(undefined, undefined, 'Activity Tester');
  const feed = (client) => client.api('get', '/v3/news_hub/feed/');
  const badge = async () => (await owner.resource('NewsHubBadgeResource')).news_hub_count;
  const follow = `/v3/users/${owner.id}/follow/`;
  await actor.api('create', follow);
  await actor.api('create', follow);
  const pin = await owner.publishPin();
  await owner.resource('AggregatedCommentResource', { pinId: pin.id, text: 'My comment' }, 'create');
  await actor.resource('AggregatedCommentResource', { pinId: pin.id, text: 'A new comment' }, 'create');

  assert.deepEqual(await feed(actor), []);
  assert.equal(await badge(), 2);
  const [comment, followed] = await feed(owner);
  assert.equal(comment.override_click_url, `/pin/${pin.id}/`);
  assert.equal(followed.override_click_url, `/${actor.username}/`);
  const hide = (client) => client.api('update', '/v3/news_hub/hide/batch/', { news_ids: [comment.id], should_hide: true });
  await hide(actor);
  assert.equal((await feed(owner)).length, 2);
  await hide(owner);
  assert.deepEqual((await feed(owner)).map((item) => item.id), [followed.id]);
  assert.equal(await badge(), 1);
  await owner.api('delete', '/v3/news_hub/badge/');
  assert.equal(await badge(), 0);
  assert.equal((await feed(owner))[0].unread, false);
});

test('disabling in-app follower notifications only affects new follow Updates', async () => {
  const owner = await new Client(server.url).signup();
  const follower = await new Client(server.url).signup();
  const settings = await owner.api('get', '/v3/settings/notifications/');
  const social = settings.find((category) => category.key === 'social');
  assert.equal(social.subcategories.find((sub) => sub.key === 'followers')
    .channel_options.find((option) => option.channel === 'news').value, true);
  await owner.api('create', '/v3/settings/notifications/', {
    updated_settings: [{ section: 'social', option: 'followers', type: 'news', value: false }],
  });
  await follower.api('create', `/v3/users/${owner.id}/follow/`);
  const pin = await owner.publishPin();
  await follower.resource('AggregatedCommentResource', { pinId: pin.id, text: 'Still enabled' }, 'create');
  const feed = await owner.api('get', '/v3/news_hub/feed/');
  assert.deepEqual(feed.map((item) => item.override_click_url), [`/pin/${pin.id}/`]);
});
