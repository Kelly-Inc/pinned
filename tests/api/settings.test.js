import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, png, uniqueName } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('edit profile loads and saves real data', async () => {
  const c = await new Client(server.url).signup(undefined, undefined, 'Sky Lo');
  let viewer = await c.api('get', '/v3/users/me/viewer/');
  assert.equal(viewer.first_name, 'Sky');
  assert.equal(viewer.last_name, 'Lo');
  await c.resource('UserSettingsResource', { last_name: 'Walker', about: 'hello', website_url: 'https://sky.example' }, 'update');
  viewer = await c.api('get', '/v3/users/me/viewer/');
  assert.equal(viewer.last_name, 'Walker');
  assert.equal(viewer.about, 'hello');
  assert.equal(viewer.website_url, 'https://sky.example');
  assert.equal(viewer.full_name, 'Sky Walker');
});

test('settings can be saved through the v3 settings endpoint too', async () => {
  const c = await new Client(server.url).signup();
  await c.api('update', '/v3/users/settings/', { about: 'via v3' });
  assert.equal((await c.resource('UserSettingsResource')).about, 'via v3');
});

test('changing username validates and enforces uniqueness', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  await assert.rejects(b.resource('UserSettingsResource', { username: a.username }, 'update'), { status: 400 });
  await assert.rejects(b.resource('UserSettingsResource', { username: 'no spaces!' }, 'update'), { status: 400 });
  const fresh = uniqueName('renamed');
  await b.resource('UserSettingsResource', { username: fresh }, 'update');
  assert.equal((await b.api('get', '/v3/users/me/')).username, fresh);
});

test('other settings toggles are stored', async () => {
  const c = await new Client(server.url).signup();
  await c.resource('UserSettingsResource', { exclude_from_search: true, surface_tag: 'settings' }, 'update');
  const s = await c.resource('UserSettingsResource');
  assert.equal(s.exclude_from_search, true);
  assert.equal(s.surface_tag, undefined);
});

test('notification settings load and save', async () => {
  const c = await new Client(server.url).signup();
  let cats = await c.api('get', '/v3/settings/notifications/');
  assert.ok(cats.length >= 1);
  const sub = cats[0].subcategories[0];
  assert.equal(sub.channel_options.every((o) => o.value === true), true);
  await c.api('create', '/v3/settings/notifications/', {
    updated_settings: JSON.stringify([{ type: 'email', section: cats[0].key, option: sub.key, value: false }]),
  });
  cats = await c.api('get', '/v3/settings/notifications/');
  const email = cats[0].subcategories[0].channel_options.find((o) => o.channel === 'email');
  assert.equal(email.value, false);
});

test('privacy settings provide the fields rendered by each platform', async () => {
  const c = await new Client(server.url).signup();
  const viewer = await c.api('get', '/v3/users/me/viewer/');
  assert.equal(viewer.allow_mentions, true);
  await c.resource('UserSettingsResource', { allow_mentions: false }, 'update');
  for (const [platform, type] of [['desktop', 'checkbox'], ['mobile', 'toggles']]) {
    const sections = await c.api('get', '/v3/users/privacy_data_settings/', { platform });
    const fields = sections.flatMap((section) => {
      assert.ok(Array.isArray(section.description));
      return section.settings_field;
    });
    assert.ok(fields.every((field) => field.id && field.label_desktop && field.label_mobile && field.setting_type === type));
    assert.equal(fields.find((field) => field.name === 'allow_mentions').value, false);
  }
});

test('pronouns are served', async () => {
  const c = await new Client(server.url).signup();
  const pronouns = await c.api('get', '/v3/users/pronouns/');
  assert.ok(pronouns.some((p) => p.label === 'they/them'));
});

test('avatar upload, status poll, display and removal', async () => {
  const c = await new Client(server.url).signup();
  const res = await c.multipart('/upload-profile-image/', 'img', png(256, 256));
  assert.equal(res.status, 200);
  const { image_upload_tracking_id: id } = await res.json();
  const status = await c.api('get', '/v3/images/upload/status/', { tracking_id: id });
  assert.equal(status[id], 4);
  const me = await c.api('get', '/v3/users/me/');
  assert.match(me.image_medium_url, /\/media\/uploads\/avatar-/);
  assert.equal((await c.raw(new URL(me.image_medium_url).pathname)).status, 200);
  await c.graphql('useRemoveProfilePhotoMutation');
  const after = await c.api('get', '/v3/users/me/');
  assert.match(after.image_medium_url, /\/avatar\/.+\.svg/);
});

test('avatar upload rejects non-images', async () => {
  const c = await new Client(server.url).signup();
  const res = await c.multipart('/upload-profile-image/', 'img', Buffer.from('definitely not an image'));
  assert.equal(res.status, 415);
});

test('generated initial avatars are SVGs', async () => {
  const c = await new Client(server.url).signup(undefined, undefined, 'Zed');
  const res = await c.raw(`/avatar/${c.id}.svg`);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
  assert.match(await res.text(), />Z</);
});
