// The app shell and the vendored client code the server rewrites.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Client } from '../helpers/server.js';

let server;
let c;
let shell;
before(async () => {
  server = await startServer();
  c = await new Client(server.url).signup(undefined, undefined, 'Shell Tester');
  shell = await (await c.raw('/')).text();
});
after(async () => { await server.stop(); });

const pwsData = () => JSON.parse(/<script id="__PWS_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(shell)[1]);

test('the shell boots the client as the logged-in user', () => {
  const data = pwsData();
  assert.equal(data.context.is_authenticated, true);
  assert.equal(data.context.user.username, c.username);
  assert.equal(data.context.user.full_name, 'Shell Tester');
});

test('the shell points at this server, never pinterest.com', () => {
  const ctx = pwsData().context;
  const host = new URL(server.url).host;
  assert.equal(ctx.request_host, host);
  assert.equal(ctx.origin, server.url);
  assert.doesNotMatch(shell, /rel="alternate"/);
  assert.doesNotMatch(shell, /s\.pinimg\.com\/webapp/);
});

test('dark mode is enabled and boot scripts are present', () => {
  const data = pwsData();
  assert.equal(data.experiments.triggerable.dweb_dark_mode, 'enabled');
  assert.match(shell, /localStorage\.getItem\('theme'\)/);
  assert.match(shell, /pdFixed/);
});

test('branding: our favicon and logo replace Pinterest\'s', async () => {
  assert.match(shell, /href="\/favicon\.ico"/);
  assert.doesNotMatch(shell, /pinterest_favicon/);
  assert.equal((await c.raw('/assets/logo-64.png')).status, 200);
  assert.equal((await c.raw('/favicon.ico')).status, 200);
});

test('vendored code is served from a versioned path with in-app links rewritten', async () => {
  const src = /src="(\/webapp\/_v[a-z0-9]+\/[^"]+\.mjs)"/.exec(shell.replaceAll(server.url, ''));
  assert.ok(src, 'versioned script path in shell');
  const res = await c.raw(src[1]);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /immutable/);
  const runtime = await (await c.raw(src[1].replace(/[^/]+\.mjs$/, '') + (await findRuntime()))).text();
  assert.match(runtime, /\.p="\/webapp\/_v[a-z0-9]+\/"/);
});

async function findRuntime() {
  const fs = await import('node:fs');
  return fs.readdirSync(new URL('../../vendor/', import.meta.url)).find((f) => f.startsWith('runtime-'));
}

test('in-app settings links in vendored code no longer point at pinterest.com', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../../vendor/', import.meta.url);
  const file = fs.readdirSync(dir).find((f) => f.endsWith('.mjs')
    && fs.readFileSync(new URL(f, dir), 'utf8').includes('"https://www.pinterest.com/settings/privacy/"'));
  assert.ok(file, 'fixture: some vendored file links to the privacy settings page');
  const body = await (await c.raw(`/webapp/${file}`)).text();
  assert.doesNotMatch(body, /https:\/\/www\.pinterest\.com\/settings/);
  assert.match(body, /"\/settings\/privacy\/"/);
  // Help pages are real Pinterest pages and stay external.
  assert.equal(body.includes('https://www.pinterest.com/_/_/help') || !fs.readFileSync(new URL(file, dir), 'utf8').includes('https://www.pinterest.com/_/_/help'), true);
});

test('missing /assets files are 404s, not the app shell', async () => {
  const res = await c.raw('/assets/ct-does-not-exist.html');
  assert.equal(res.status, 404);
});

test('path traversal is blocked', async () => {
  const res = await c.raw('/assets/..%2f..%2fserver.js');
  assert.notEqual(res.status, 200);
});

test('/search keeps its query', async () => {
  const res = await c.raw('/search/?q=cats');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/search/pins/?q=cats');
});
