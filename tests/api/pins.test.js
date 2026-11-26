import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('publishing through the pin builder creates a real pin', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin({ title: 'Sunset', description: 'orange sky', link: 'https://example.com', width: 500, height: 750 });
  assert.equal(pin.title, 'Sunset');
  assert.equal(pin.description, 'orange sky');
  assert.equal(pin.link, 'https://example.com');
  assert.equal(pin.images.orig.width, 500);
  assert.equal(pin.images.orig.height, 750);
  assert.equal(pin.pinner.username, c.username);
  const img = await c.raw(new URL(pin.images.orig.url).pathname);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
});

test('upload status reports registered then succeeded', async () => {
  const c = await new Client(server.url).signup();
  const reg = await c.api('create', '/v3/media/uploads/register/', { type: 'pinimage' });
  assert.ok(reg.upload_id && reg.upload_url);
  const before = await c.api('get', '/v3/media/uploads/', { upload_ids: [reg.upload_id] });
  assert.equal(before[reg.upload_id].status, 'registered');
  const { png } = await import('../helpers/server.js');
  const up = await c.multipart(new URL(reg.upload_url).pathname, 'file', png(300, 300));
  assert.equal(up.status, 204);
  const afterUp = await c.api('get', '/v3/media/uploads/', { upload_ids: [reg.upload_id] });
  assert.equal(afterUp[reg.upload_id].status, 'succeeded');
  assert.equal(afterUp[reg.upload_id].signature, reg.upload_id);
});

test('uploads reject non-images and other users', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const reg = await a.api('create', '/v3/media/uploads/register/', {});
  const path = new URL(reg.upload_url).pathname;
  assert.equal((await b.multipart(path, 'file', Buffer.from('nope'))).status, 404);
  assert.equal((await a.multipart(path, 'file', Buffer.from('not an image at all'))).status, 415);
});

test('publishing with another user\'s upload is refused', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const reg = await a.api('create', '/v3/media/uploads/register/', {});
  const { png } = await import('../helpers/server.js');
  await a.multipart(new URL(reg.upload_url).pathname, 'file', png(300, 400));
  const story = { metadata: { pin_image_signature: reg.upload_id }, pages: [] };
  await assert.rejects(b.api('create', '/v3/storypins/', { story_pin: JSON.stringify(story) }), { status: 400 });
});

test('pins show on the homefeed, profile and pin page', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin({ title: 'Feed me' });
  const feed = await c.resource('UserHomefeedResource');
  assert.ok(feed.some((p) => p.id === pin.id));
  const profile = await c.api('get', '/v3/users/me/filtered/pins/');
  assert.deepEqual(profile.map((p) => p.id), [pin.id]);
  const byResource = await c.resource('UserPinsResource', { username: c.username });
  assert.ok(byResource.some((p) => p.id === pin.id));
  const page = await c.resource('PinResource', { id: pin.id });
  assert.equal(page.title, 'Feed me');
});

test('the profile Pins tab also works as a POSTed get', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin();
  const res = await c.raw('/resource/ApiResource/get/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: JSON.stringify({ options: { url: '/v3/users/me/filtered/pins/', data: {} } }) }).toString(),
  });
  const data = (await res.json()).resource_response.data;
  assert.deepEqual(data.map((p) => p.id), [pin.id]);
});

test('owners can edit and delete their pins; others cannot edit', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const pin = await a.publishPin({ title: 'Original' });
  await assert.rejects(b.resource('PinResource', { id: pin.id, title: 'Hacked' }, 'update'), { status: 403 });
  const edited = await a.resource('PinResource', { id: pin.id, title: 'Edited' }, 'update');
  assert.equal(edited.title, 'Edited');
  await a.resource('PinResource', { id: pin.id }, 'delete');
  assert.equal(await a.resource('PinResource', { id: pin.id }), null);
});

test('deleting someone else\'s pin only removes it from your saves', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const pin = await a.publishPin();
  await b.resource('RepinResource', { pin_id: pin.id }, 'create');
  await b.resource('PinResource', { id: pin.id }, 'delete');
  assert.equal((await a.resource('PinResource', { id: pin.id })).id, pin.id);
  assert.equal((await b.resource('PinResource', { id: pin.id })).is_saved, false);
});

test('search finds pins by title and description', async () => {
  const c = await new Client(server.url).signup();
  await c.publishPin({ title: 'Zebra stripes', description: 'savanna' });
  const byTitle = await c.resource('BaseSearchResource', { query: 'zebra', scope: 'pins' });
  assert.ok(byTitle.results.some((p) => p.title === 'Zebra stripes'));
  const byDesc = await c.resource('BaseSearchResource', { query: 'savanna', scope: 'pins' });
  assert.ok(byDesc.results.length >= 1);
});

test('shop-the-look modules are empty lists, not the feed', async () => {
  const c = await new Client(server.url).signup();
  const pin = await c.publishPin();
  assert.deepEqual(await c.api('get', `/v3/visual_search/stela/pins/${pin.id}/module/`), []);
});

test('a closeup requests matching pins through RelatedModulesResource', async () => {
  const c = await new Client(server.url).signup();
  const seed = await c.publishPin({ title: 'Hydrangea planting' });
  const match = await c.publishPin({ title: 'Hydrangea pruning' });
  await c.publishPin({ title: 'Ceramic vase' });
  const pins = await c.resource('RelatedModulesResource', { pin_id: seed.id, page_size: 12 });
  assert.deepEqual(pins.map((pin) => pin.id), [match.id]);
});
