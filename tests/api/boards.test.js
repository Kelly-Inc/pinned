import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('create, list, rename and delete a board', async () => {
  const c = await new Client(server.url).signup();
  const board = await c.resource('BoardResource', { name: 'Cats', description: 'meow' }, 'create');
  assert.equal(board.name, 'Cats');
  assert.equal(board.owner.username, c.username);
  assert.equal(board.url, `/${c.username}/cats/`);

  const list = await c.resource('BoardsResource', { username: c.username });
  assert.deepEqual(list.map((b) => b.id), [board.id]);

  const renamed = await c.resource('BoardResource', { board_id: board.id, name: 'Kitties', privacy: 'secret' }, 'update');
  assert.equal(renamed.name, 'Kitties');

  await c.resource('BoardResource', { board_id: board.id }, 'delete');
  assert.deepEqual(await c.resource('BoardsResource'), []);
});

test('boards are found by username and slug', async () => {
  const c = await new Client(server.url).signup();
  const board = await c.resource('BoardResource', { name: 'Home Decor Ideas' }, 'create');
  const found = await c.resource('BoardResource', { username: c.username, slug: 'home-decor-ideas' });
  assert.equal(found.id, board.id);
});

test('other users cannot edit, delete or save into your board', async () => {
  const a = await new Client(server.url).signup();
  const b = await new Client(server.url).signup();
  const board = await a.resource('BoardResource', { name: 'Mine' }, 'create');
  const pin = await b.publishPin();
  await assert.rejects(b.resource('BoardResource', { board_id: board.id, name: 'Hacked' }, 'update'), { status: 403 });
  await assert.rejects(b.resource('BoardResource', { board_id: board.id }, 'delete'), { status: 403 });
  await assert.rejects(b.resource('RepinResource', { pin_id: pin.id, board_id: board.id }, 'create'), { status: 403 });
});

test('saving a pin to a board fills the board', async () => {
  const c = await new Client(server.url).signup();
  const board = await c.resource('BoardResource', { name: 'Saved stuff' }, 'create');
  const pin = await c.publishPin({ boardId: board.id });
  const feed = await c.resource('BoardFeedResource', { board_id: board.id });
  assert.deepEqual(feed.map((p) => p.id), [pin.id]);
  const after = await c.resource('BoardResource', { board_id: board.id });
  assert.equal(after.pin_count, 1);
});

test('the board picker lists your boards', async () => {
  const c = await new Client(server.url).signup();
  await c.resource('BoardResource', { name: 'One' }, 'create');
  const picker = await c.resource('BoardPickerBoardsResource');
  assert.equal(picker.all_boards.length, 1);
  assert.equal(picker.boards_shortlist.length, 1);
});

test('a new account has no boards', async () => {
  const c = await new Client(server.url).signup();
  assert.deepEqual(await c.resource('BoardsResource'), []);
});
