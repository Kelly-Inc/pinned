import { avatarUrl } from './shape.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHELL_PATH = path.join(ROOT, 'data', 'pinterest_home.html');

const shell = fs.readFileSync(SHELL_PATH, 'utf8');

function replaceJsonScript(html, id, transform) {
  const pattern = new RegExp(`(<script id="${id}" type="application/json">)([\\s\\S]*?)(</script>)`);
  return html.replace(pattern, (_match, open, body, close) => {
    const data = JSON.parse(body);
    transform(data);
    return open + JSON.stringify(data) + close;
  });
}

// The captured page is an unauthenticated React streaming render. Its hidden
// SSR fragments are for a login page, so keeping them makes the authenticated
// client hydrate mismatched markup. Drop them and let the client render fresh.
function stripStreamedSsr(html) {
  // Initial props live inside one of the hidden stream payloads, but the
  // client waits for the paired COMPLETE template before starting the app.
  // Lift both out before pruning the streamed markup.
  const bootstrap = /<script id="__PWS_INITIAL_PROPS__" type="application\/json">[\s\S]*?<\/script>(?:<template id="__PWS_INITIAL_PROPS_COMPLETE__"><\/template>)?/.exec(html)?.[0] || '';
  if (bootstrap) html = html.replace(bootstrap, '');

  const rootStart = html.indexOf('<div data-reactcontainer="true" id="__PWS_ROOT__">');
  if (rootStart >= 0) {
    let i = rootStart + '<div data-reactcontainer="true" id="__PWS_ROOT__">'.length;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const open = html.indexOf('<div', i);
      const close = html.indexOf('</div>', i);
      if (close < 0) break;
      if (open >= 0 && open < close) {
        depth += 1;
        i = open + 4;
      } else {
        depth -= 1;
        i = close + 6;
      }
    }
    html = html.slice(0, rootStart) + '<div data-reactcontainer="true" id="__PWS_ROOT__"></div>' +
      html.slice(i);
  }

  // Remove React's hidden S:* payloads. They contain the old login UI and
  // external image preloads that do not belong to our local app.
  let match;
  while ((match = /<div hidden id="S:\d+">/.exec(html))) {
    const start = match.index;
    let i = start + match[0].length;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const open = html.indexOf('<div', i);
      const close = html.indexOf('</div>', i);
      if (close < 0) break;
      if (open >= 0 && open < close) {
        depth += 1;
        i = open + 4;
      } else {
        depth -= 1;
        i = close + 6;
      }
    }
    html = html.slice(0, start) + html.slice(i);
  }

  html = html
    .replace(/<script[^>]*data-relay-(?:pending|completed|rejected)-request[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/\$RS\("S:\d+","P:\d+"\)/g, 'void 0')
    .replace(/<link[^>]+as="image"[^>]*>/g, '');

  if (bootstrap) {
    const emptyRoot = '<div data-reactcontainer="true" id="__PWS_ROOT__"></div>';
    html = html.replace(emptyRoot, emptyRoot + bootstrap);
  }
  return html;
}

/**
 * Turn the captured unauthenticated Pinterest shell into a shell that boots
 * the real Pinterest web client in "authenticated" mode against our origin.
 */
export function buildHtml({ origin, user, build = '' }) {
  let html = shell
    .replaceAll('https://s.pinimg.com/webapp/', `${origin}/webapp/${build ? build + '/' : ''}`)
    .replaceAll('https://www.pinterest.com', origin)
    .replaceAll('https://api.pinterest.com', `${origin}/api`)
    // Our storage-report code uses https://<hostname>, which is not served
    // locally; the original CSP also blocks it. Drop the meta policy entirely.
    .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*\/>/g, '');

  html = replaceJsonScript(html, '__PWS_DATA__', (data) => {
    const context = data.context;
    context.is_authenticated = true;
    context.autologin = null;
    context.country = 'US';
    context.country_from_ip = 'US';
    context.country_from_hostname = 'US';
    context.locale = 'en-US';
    context.full_path = '/';
    context.current_url = `${origin}/`;
    context.origin = origin;
    context.request_host = new URL(origin).host;
    context.theme = 'light';
    context.userId = user.id;
    context.loginState = 1;
    context.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      image_medium_url: avatarUrl(user, origin),
      image_large_url: avatarUrl(user, origin),
      is_verified_merchant: false,
      verified_identity: {},
    };
    // Enable the client's (experiment-gated) dark mode support.
    if (data.experiments) {
      data.experiments.triggerable = { ...(data.experiments.triggerable || {}), dweb_dark_mode: 'enabled' };
      data.experiments.active = { ...(data.experiments.active || {}), dweb_dark_mode: 'enabled' };
    }
    data.initialHandlerId = 'www/index.js';
    data.renderMode = 'shellReady';
  });

  html = replaceJsonScript(html, '__PWS_INITIAL_PROPS__', (data) => {
    const state = data.initialReduxState;
    const session = state.session;
    session.isAuthenticated = true;
    session.userId = user.id;
    session.origin = origin;
    session.isDataSaver = false;
    const viewer = {
      // AppWrapper looks for a user with login_state to build ViewerContext.
      // Without this, the viewer stays Unauthenticated and the client throws.
      login_state: 1,
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      image_medium_url: avatarUrl(user, origin),
      image_large_url: avatarUrl(user, origin),
      follower_count: 0,
      following_count: 0,
      pin_count: 0,
      board_count: 0,
      is_partner: false,
      verified_identity: {},
    };
    state.users[user.id] = viewer;
    // Profile components index users by username (including the /me/ alias).
    state.users[user.username] = viewer;
    state.users.me = viewer;
    state.currentUserTracker.isAuthenticated = 1;
    state.feeds = state.feeds || {};
    state.resources = state.resources || {};
  });

  // Pin closeup sizes itself from its content; with a sparse local pin (no
  // comments/related modules) it collapses and crushes the image. Give it the
  // standard fixed desktop card width with an even image/details split.
  const css = `<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/logo-192.png">
<style id="pinterestd-fixes">
[data-test-id="pinterest-logo-home-button"] svg, [data-test-id="unauth-header-logo"] svg { visibility: hidden; }
[data-test-id="pinterest-logo-home-button"] div[style*="translate(-50%"] { display: none !important; }
[data-test-id="pinterest-logo-home-button"] a,
[data-test-id="unauth-header-logo"] a {
  background: url(/assets/logo-64.png) center / 32px 32px no-repeat !important;
}
@media (min-width: 900px) {
  [data-test-id="closeup-lego-container"] { width: min(1016px, calc(100vw - 140px)) !important; margin: 0 auto; }
  [data-test-id="closeup-lego-container"] div:has([data-test-id="closeup-body-style"]),
  [data-test-id="closeup-body-style"],
  [data-test-id="closeup-body-style"] > div,
  [data-test-id="closeup-body-style"] > div > div { flex: 1 1 auto !important; width: 100% !important; }
  [data-test-id="closeup-media-container"],
  [data-test-id="closeup-media-container"] div:has([data-test-id="visual-content-container"]),
  [data-test-id="visual-content-container"],
  [data-test-id="closeup-visual-container"] { flex: 0 0 auto !important; width: fit-content !important; max-width: 50vw !important; }
  [data-test-id="description-content-container"] { flex: 1 1 auto !important; max-width: none !important; min-width: 0; }
  [data-test-id="description-content-container"] > div,
  [data-test-id="closeup-body-sticky-content"],
  [data-test-id="closeupActionBar"] { width: 100% !important; max-width: none !important; }
}
</style>`;
  html = html.replace('</head>', `${css}</head>`);
  // Replace the stock Pinterest icons with ours (added in the <head> block above).
  html = html.replace(/<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon|mask-icon)"[^>]*\/?>/g, '');
  // Drop links to the regional pinterest.com sites.
  html = html.replace(/<link[^>]+rel="(?:alternate|canonical)"[^>]*\/?>/g, '');
  // Dark mode: the client only honours it when the boot context says so, and
  // its theme cookie is Secure-only (dropped on plain http). Read the theme the
  // client saved in localStorage and patch the boot JSON before the app starts.
  const themeBoot = `<script>(function(){try{var t=localStorage.getItem('theme');if(!t)return;var h=(new Date).getHours();var dark=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches)||(t==='daynight'&&(h>=18||h<6));var el=document.getElementById('__PWS_DATA__');if(!el)return;var d=JSON.parse(el.textContent);d.context.theme=dark?'dark':'light';el.textContent=JSON.stringify(d);}catch(e){}})();</script>`;
  // Keep the client's links to its own app pages on this server. Some are built
  // at runtime from a hardcoded "www.pinterest.com" host, so fix them live.
  const linkFix = `<script>(function(){var APP=/^\\/(settings|pin|homefeed|search|edit|reports-and-violations|ideas|today|notifications|inbox|pin-creation-tool|pin-builder|engagement|me)(\\/|$)/;
function local(u){try{var x=new URL(u,location.href);if(x.origin===location.origin)return null;if(!/^(www\\.)?pinterest\\.com$/.test(x.hostname))return null;if(!APP.test(x.pathname))return null;return x.pathname+x.search+x.hash;}catch(e){return null;}}
function fix(a){var h=a.getAttribute('href');if(!h)return;var l=local(h);if(l){a.setAttribute('href',l);a.removeAttribute('target');a.dataset.pdFixed='1';}}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var l=local(a.getAttribute('href'))||(a.getAttribute('href').charAt(0)==='/'&&a.dataset.pdFixed?a.getAttribute('href'):null);if(!l)return;e.preventDefault();e.stopImmediatePropagation();history.pushState({},'',l);dispatchEvent(new PopStateEvent('popstate',{state:{}}));},true);
new MutationObserver(function(ms){ms.forEach(function(m){if(m.type==='attributes'){if(m.target.tagName==='A')fix(m.target);}else m.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.tagName==='A')fix(n);n.querySelectorAll&&n.querySelectorAll('a[href]').forEach(fix);});});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
var oa=location.assign.bind(location),or=location.replace.bind(location),ow=window.open;
location.assign=function(u){var l=local(u);return oa(l||u);};location.replace=function(u){var l=local(u);return or(l||u);};
window.open=function(u){var l=u&&local(u);if(l){location.href=l;return null;}return ow.apply(window,arguments);};})();</script>`;
  html = html.replace(/(<script[^>]*id="__PWS_DATA__"[^>]*>[\s\S]*?<\/script>)/, `$1${themeBoot}${linkFix}`);
  return stripStreamedSsr(html);
}
