// The captured page is an unauthenticated React streaming render. Its hidden
// SSR fragments are for a login page, so keeping them would make the
// authenticated client hydrate mismatched markup. Remove them and let the
// client render fresh.

/** Index just past the </div> that closes the <div> opened before `from`. */
function closingDiv(html, from) {
  let i = from;
  let depth = 1;
  while (i < html.length && depth > 0) {
    const open = html.indexOf('<div', i);
    const close = html.indexOf('</div>', i);
    if (close < 0) break;
    if (open >= 0 && open < close) { depth += 1; i = open + 4; } else { depth -= 1; i = close + 6; }
  }
  return i;
}

const ROOT = '<div data-reactcontainer="true" id="__PWS_ROOT__">';
const EMPTY_ROOT = `${ROOT}</div>`;

export function stripStreamedSsr(html) {
  // Initial props live inside a hidden stream payload, and the client waits
  // for the paired COMPLETE marker. Lift both out before pruning.
  const bootstrap = /<script id="__PWS_INITIAL_PROPS__" type="application\/json">[\s\S]*?<\/script>(?:<template id="__PWS_INITIAL_PROPS_COMPLETE__"><\/template>)?/.exec(html)?.[0] || '';
  if (bootstrap) html = html.replace(bootstrap, '');

  const rootStart = html.indexOf(ROOT);
  if (rootStart >= 0) {
    const end = closingDiv(html, rootStart + ROOT.length);
    html = html.slice(0, rootStart) + EMPTY_ROOT + html.slice(end);
  }

  let match;
  while ((match = /<div hidden id="S:\d+">/.exec(html))) {
    const end = closingDiv(html, match.index + match[0].length);
    html = html.slice(0, match.index) + html.slice(end);
  }

  html = html
    .replace(/<script[^>]*data-relay-(?:pending|completed|rejected)-request[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/\$RS\("S:\d+","P:\d+"\)/g, 'void 0')
    .replace(/<link[^>]+as="image"[^>]*>/g, '');

  if (bootstrap) html = html.replace(EMPTY_ROOT, EMPTY_ROOT + bootstrap);
  return html;
}
