// Builds the HTML that boots the vendored client for one user.
import fs from 'node:fs';
import { SHELL_PATH } from '../../config.js';
import { editJsonScript } from './json.js';
import { stripStreamedSsr } from './ssr.js';
import { patchBootData, patchInitialState } from './context.js';
import { themeScript, linksScript, fixesStyle, headLinks } from '../inject/index.js';

const template = fs.readFileSync(SHELL_PATH, 'utf8');

export function buildShell({ origin, user, build = '' }) {
  let html = template
    .replaceAll('https://s.pinimg.com/webapp/', `${origin}/webapp/${build ? `${build}/` : ''}`)
    .replaceAll('https://www.pinterest.com', origin)
    .replaceAll('https://api.pinterest.com', `${origin}/api`)
    // The original CSP blocks our own origin's helpers.
    .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*\/>/g, '')
    // Pinterest's icons and links to its regional sites.
    .replace(/<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|mask-icon)"[^>]*\/?>/g, '')
    .replace(/<link[^>]+rel="(?:alternate|canonical)"[^>]*\/?>/g, '');

  html = editJsonScript(html, '__PWS_DATA__', (data) => patchBootData(data, { origin, user }));
  html = editJsonScript(html, '__PWS_INITIAL_PROPS__', (data) => patchInitialState(data, { origin, user }));

  // Our icons and fixes go in after the stock ones were stripped.
  html = html.replace('</head>', `${headLinks}${fixesStyle}</head>`);
  html = html.replace(/(<script[^>]*id="__PWS_DATA__"[^>]*>[\s\S]*?<\/script>)/, `$1${themeScript}${linksScript}`);
  return stripStreamedSsr(html);
}
