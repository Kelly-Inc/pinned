#!/usr/bin/env node
/** Load the local client in headless Chromium and report what it does. */
import { chromium } from 'playwright-core';

const URL_ = process.argv[2] || 'http://localhost:3000/';
const SCREENSHOT = process.argv[3] || '/tmp/pinterestd.png';
const executablePath = '/root/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const requests = [];
const errors = [];
page.on('request', (request) => {
  const url = request.url();
  if (url.includes('/resource/') || url.includes('graphql') || url.includes('/v3/')) {
    requests.push(`${request.method()} ${url.slice(url.indexOf('/', url.indexOf('//') + 2))}`);
  }
});
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    errors.push(`[${message.type()}] ${message.text().slice(0, 400)}`);
  }
});
page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message.slice(0, 400)}`));
page.on('response', (response) => {
  const url = response.url();
  const type = response.headers()['content-type'] || '';
  if (response.status() >= 400 || type.includes('text/html')) {
    if (!url.startsWith('http://localhost:3000/') || url === 'http://localhost:3000/') return;
    errors.push(`[response ${response.status()} ${type}] ${url}`);
  }
});
page.on('requestfailed', (request) => {
  const url = request.url();
  if (url.startsWith('http://localhost:3000/')) {
    errors.push(`[requestfailed] ${url} ${request.failure()?.errorText || ''}`);
  }
});

await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(12000);
await page.screenshot({ path: SCREENSHOT, fullPage: false });

console.log('TITLE:', await page.title());
console.log('ROOT HTML LENGTH:', (await page.locator('#__PWS_ROOT__').innerHTML()).length);
console.log('IMAGES:', await page.locator('img').count());
console.log('TEXT:', (await page.locator('body').innerText()).slice(0, 1200));
console.log('\nAPI REQUESTS:');
console.log([...new Set(requests)].slice(0, 60).join('\n') || '(none)');
console.log('\nERRORS:');
console.log([...new Set(errors)].slice(0, 30).join('\n') || '(none)');
console.log('\nSCREENSHOT:', SCREENSHOT);

await browser.close();
