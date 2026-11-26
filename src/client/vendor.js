// Serves the vendored client. Code is rewritten once per file and cached:
//  - in-app pinterest.com links stay on this server (help/policy pages stay external)
//  - the chunk loader path is versioned per server start, so browsers always
//    pick up new code after a restart while caching it forever in between.
import fs from 'node:fs';

const APP_ROUTES = 'settings|pin|homefeed|search|engagement|edit|attribution_source|username|ideas|today|notifications|inbox|pin-creation-tool|pin-builder|business/hub';
const IN_APP_LINK = new RegExp(`https://(?:www\\.)?pinterest\\.com(?=/(?:${APP_ROUTES})(?:[/?#"'\`]|$))`, 'g');

export const BUILD = `_v${Date.now().toString(36)}`;

export function rewriteVendor(code) {
  return code
    .replace(IN_APP_LINK, '')
    .replaceAll('"https://www.pinterest.com"', '(typeof location!=="undefined"?location.origin:"")')
    .replace('.p="/webapp/"', `.p="/webapp/${BUILD}/"`);
}

/** Strip the version segment from /webapp/_vXXXX/file.mjs. */
export const unversion = (rel) => rel.replace(/^_v[a-z0-9]+\//, '');

const cache = new Map();

export function vendorScript(file) {
  let body = cache.get(file);
  if (!body) {
    body = Buffer.from(rewriteVendor(fs.readFileSync(file, 'utf8')));
    cache.set(file, body);
  }
  return body;
}
