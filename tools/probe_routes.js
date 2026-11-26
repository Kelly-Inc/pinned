#!/usr/bin/env node
/** Render the important routes with the real client and report what it did. */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:3000';

async function resource(name, options = {}) {
  const data = encodeURIComponent(JSON.stringify({ options, context: {} }));
  const response = await fetch(`${BASE}/resource/${name}/get/?data=${data}`);
  const body = await response.json();
  return body.resource_response?.data;
}

const feed = await resource('UserHomefeedResource', { page_size: 1 });
const pinId = Array.isArray(feed) ? feed[0]?.id : null;
const picker = await resource('BoardPickerBoardsResource');
const board = picker?.all_boards?.[0];

const routes = [
  ['home', '/'],
  ['search', '/search/pins/?q=skincare'],
  ...(pinId ? [['pin', `/pin/${pinId}/`]] : []),
  ['profile', '/me/'],
  ['pinner', '/localuser/'],
  ...(board ? [['board', board.url || '/localuser/']] : []),
];

const executablePath = '/root/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });

for (const [label, route] of routes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const api = [];
  const errors = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/resource/') || url.includes('graphql') || url.includes('/v3/')) {
      api.push(`${request.method()} ${new URL(url).pathname}${new URL(url).search.slice(0, 220)}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message.slice(0, 200)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console] ${message.text().slice(0, 200)}`);
  });
  page.on('response', (response) => {
    const type = response.headers()['content-type'] || '';
    if (response.url().startsWith(BASE) && response.url() !== BASE + '/' &&
        (response.status() >= 400 || (type.includes('text/html') && !response.url().includes('arkose')))) {
      errors.push(`[response ${response.status()} ${type}] ${response.url()}`);
    }
  });

  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  const text = (await page.locator('#__PWS_ROOT__').innerText()).replace(/\s+/g, ' ').slice(0, 500);
  console.log(`\n=== ${label} ${route}`);
  console.log('TEXT:', text);
  console.log('IMAGES:', await page.locator('img').count());
  console.log('API:', [...new Set(api)].slice(0, 20).join('\n     ') || '(none)');
  console.log('ERRORS:', [...new Set(errors)].slice(0, 10).join('\n        ') || '(none)');
  await page.close();
}

await browser.close();
