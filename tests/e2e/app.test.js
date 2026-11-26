// End-to-end: drives the real vendored client in headless Chromium against a
// throwaway server. Fails on page errors and on any navigation to pinterest.com.
//
//   npm run test:e2e
//
// Needs a Chromium for playwright-core: set PINNED_CHROMIUM to its path, or
// install one with `npx playwright install chromium`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, png, uniqueName } from '../helpers/server.js';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch {}

function findChromium() {
  if (process.env.PINNED_CHROMIUM) return process.env.PINNED_CHROMIUM;
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  for (const dir of fs.readdirSync(cache).sort().reverse()) {
    for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/chrome']) {
      const candidate = path.join(cache, dir, rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const skip = !chromium ? 'playwright-core not installed (npm install)' : false;

let server;
let browser;
let page;
let base;
const problems = [];
const imageFile = path.join(os.tmpdir(), `pinned-e2e-${process.pid}.png`);

before(async () => {
  if (skip) return;
  server = await startServer();
  base = server.url;
  fs.writeFileSync(imageFile, png(400, 600, [60, 120, 200]));
  browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // Nothing should ever load a pinterest.com page.
  await context.route(/^https?:\/\/([a-z]+\.)?pinterest\.com/, (route) => {
    if (route.request().resourceType() === 'document') problems.push(`navigated off-site: ${route.request().url()}`);
    route.abort();
  });
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 200)}`));
});

after(async () => {
  await browser?.close();
  await server?.stop();
  fs.rmSync(imageFile, { force: true });
});

const go = async (p, wait = 3000) => { await page.goto(base + p); await page.waitForTimeout(wait); };
const text = () => page.evaluate(() => document.body.innerText);

test('sign up lands on the home feed', { skip }, async () => {
  await go('/signup', 500);
  await page.fill('input[name=username]', uniqueName('e2e'));
  await page.fill('input[name=full_name]', 'Eve Tester');
  await page.fill('input[name=password]', 'password123');
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.ok(await page.$('[data-test-id="header-profile"]'), 'header rendered');
});

test('publish a pin through the pin builder', { skip }, async () => {
  await go('/pin-creation-tool/', 500);
  const input = await page.waitForSelector('input[type=file]', { state: 'attached', timeout: 30_000 });
  const uploaded = page.waitForResponse((r) => /\/upload\/[a-f0-9]+/.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 });
  await input.setInputFiles(imageFile);
  assert.equal((await uploaded).status(), 204);
  await page.fill('#storyboard-selector-title', 'E2E blue pin');
  const published = page.waitForResponse((r) => r.url().includes('/resource/ApiResource/create/')
    && new URLSearchParams(r.request().postData() || '').get('data')?.includes('"/v3/storypins/"'), { timeout: 60_000 });
  await page.locator('button:has-text("Publish")').first().click({ timeout: 60_000 });
  assert.equal((await published).status(), 200);
  await go('/', 4000);
  assert.match(await text(), /E2E blue pin/);
});

test('the pin shows on the profile Pins tab', { skip }, async () => {
  const username = await page.evaluate(() => JSON.parse(document.getElementById('__PWS_DATA__').textContent).context.user.username);
  await go(`/${username}/_pins/`, 4000);
  const imgs = await page.$$('[data-test-id="pin"], [data-grid-item="true"]');
  assert.ok(imgs.length >= 1, 'profile has at least one pin');
});

test('liking a pin survives a reload', { skip }, async () => {
  await go('/', 3000);
  await page.click('a[href*="/pin/"]');
  await page.waitForTimeout(4000);
  const react = await page.$('[data-test-id="react-button"]');
  assert.ok(react, 'react button on pin page');
  await react.click();
  await page.waitForTimeout(2000);
  await page.reload();
  await page.waitForTimeout(4000);
  const count = await page.$eval('[data-test-id="reactions-count"]', (el) => el.innerText.trim()).catch(() => '');
  assert.equal(count, '1');
});

test('gear menu items stay on this server', { skip }, async () => {
  for (const item of ['Settings', 'Link to Pinterest', 'Your privacy rights', 'Refine your recommendations']) {
    await go('/', 2500);
    await page.click('[data-test-id="vertical-nav-settings-button"]');
    await page.waitForTimeout(1000);
    await page.click(`text="${item}"`);
    await page.waitForTimeout(2500);
    assert.equal(new URL(page.url()).origin, base, `${item} stayed local`);
  }
});

test('settings pages render content', { skip }, async () => {
  for (const tab of ['edit-profile', 'account-settings', 'profile-visibility', 'edit/display-settings', 'notifications', 'security']) {
    await go(`/settings/${tab}/`, 3000);
    assert.ok((await text()).length > 200, `${tab} has content`);
  }
});

test('privacy tab renders its controls and saves changes', { skip }, async () => {
  await page.goto(base + '/settings/edit-profile/');
  await page.getByText('Privacy and data', { exact: true }).click();
  const mentions = page.getByRole('checkbox', { name: /Mentions/i });
  await mentions.waitFor();
  assert.equal(await mentions.isChecked(), true);
  await mentions.uncheck();
  const saved = page.waitForResponse((res) => res.url().includes('/resource/UserSettingsResource/update/'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  assert.ok((await saved).ok());
  await page.reload();
  await mentions.waitFor();
  assert.equal(await mentions.isChecked(), false);
});

test('edit profile shows the real name and saves changes', { skip }, async () => {
  await go('/settings/edit-profile/', 4000);
  assert.equal(await page.inputValue('#first_name'), 'Eve');
  await page.fill('#about', 'hello from e2e');
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(4000);
  assert.equal(await page.inputValue('#about'), 'hello from e2e');
});

test('avatar upload shows in the header', { skip }, async () => {
  await go('/settings/edit-profile/', 4000);
  await page.click('button:has-text("Change")');
  await page.waitForTimeout(1000);
  const inputs = await page.$$('input[type=file]');
  await inputs[inputs.length - 1].setInputFiles(imageFile);
  await page.waitForTimeout(4000);
  await go('/', 3000);
  const src = await page.$eval('[data-test-id="header-profile"] img', (img) => img.getAttribute('src'));
  assert.match(src, /\/media\/uploads\/avatar-/);
});

test('dark theme applies after reload', { skip }, async () => {
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await go('/', 4000);
  const theme = await page.evaluate(() => JSON.parse(document.getElementById('__PWS_DATA__').textContent).context.theme);
  assert.equal(theme, 'dark');
  await page.evaluate(() => localStorage.removeItem('theme'));
});

test('no page errors or off-site navigation happened', { skip }, () => {
  assert.deepEqual(problems, []);
});
