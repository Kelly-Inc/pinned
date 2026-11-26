import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client, uniqueName } from '../helpers/server.js';

let server;
before(async () => { server = await startServer(); });
after(async () => { await server.stop(); });

test('anonymous visitors are sent to the login page', async () => {
  const c = new Client(server.url);
  const res = await c.raw('/');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
});

test('API calls without a session get 401', async () => {
  const c = new Client(server.url);
  const res = await c.raw('/resource/BoardsResource/get/');
  assert.equal(res.status, 401);
});

test('login and signup pages render', async () => {
  const c = new Client(server.url);
  for (const page of ['/login', '/signup']) {
    const res = await c.raw(page);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<form method="post"/);
  }
});

test('signup creates an account and logs in', async () => {
  const c = await new Client(server.url).signup();
  const me = await c.api('get', '/v3/users/me/');
  assert.equal(me.username, c.username);
  assert.equal(me.follower_count, 0);
  assert.equal(me.following_count, 0);
  assert.equal(me.pin_count, 0);
});

test('signup validates username and password', async () => {
  const c = new Client(server.url);
  assert.equal((await c.form('/signup', { username: 'ab', password: 'password123' })).status, 400);
  assert.equal((await c.form('/signup', { username: uniqueName(), password: 'short' })).status, 400);
});

test('usernames are unique (case-insensitive)', async () => {
  const name = uniqueName('Dup');
  await new Client(server.url).signup(name);
  const res = await new Client(server.url).form('/signup', { username: name.toLowerCase(), password: 'password123' });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /taken/);
});

test('login works with the right password only', async () => {
  const a = await new Client(server.url).signup();
  const bad = await new Client(server.url).form('/login', { username: a.username, password: 'wrong-password' });
  assert.equal(bad.status, 401);
  const c = new Client(server.url);
  const ok = await c.form('/login', { username: a.username, password: a.password });
  assert.equal(ok.status, 303);
  assert.equal((await c.raw('/')).status, 200);
});

test('logged-in users visiting /login are sent home', async () => {
  const c = await new Client(server.url).signup();
  const res = await c.raw('/login');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/');
});

test('logout ends the session', async () => {
  const c = await new Client(server.url).signup();
  await c.raw('/logout');
  assert.equal((await c.raw('/')).status, 303);
});

test('there is no built-in default account', async () => {
  const res = await new Client(server.url).form('/login', { username: 'localuser', password: 'password123' });
  assert.equal(res.status, 401);
});
