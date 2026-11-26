// Keeps the client's links to its own app pages on this server. Some are
// built at runtime from a hardcoded "www.pinterest.com" host, so they are
// fixed live: hrefs are rewritten, clicks go through the client router, and
// location.assign / replace / window.open are redirected.
(function () {
  var APP = /^\/(settings|pin|homefeed|search|edit|reports-and-violations|ideas|today|notifications|inbox|pin-creation-tool|pin-builder|engagement|me)(\/|$)/;

  function local(url) {
    try {
      var x = new URL(url, location.href);
      if (x.origin === location.origin) return null;
      if (!/^(www\.)?pinterest\.com$/.test(x.hostname)) return null;
      if (!APP.test(x.pathname)) return null;
      return x.pathname + x.search + x.hash;
    } catch (e) { return null; }
  }

  function fix(a) {
    var href = a.getAttribute('href');
    if (!href) return;
    var l = local(href);
    if (l) {
      a.setAttribute('href', l);
      a.removeAttribute('target');
      a.dataset.pdFixed = '1';
    }
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var l = local(href) || (href.charAt(0) === '/' && a.dataset.pdFixed ? href : null);
    if (!l) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    history.pushState({}, '', l);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, true);

  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type === 'attributes') {
        if (m.target.tagName === 'A') fix(m.target);
        return;
      }
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'A') fix(n);
        if (n.querySelectorAll) n.querySelectorAll('a[href]').forEach(fix);
      });
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });

  var assign = location.assign.bind(location);
  var replace = location.replace.bind(location);
  var open = window.open;
  location.assign = function (u) { return assign(local(u) || u); };
  location.replace = function (u) { return replace(local(u) || u); };
  window.open = function (u) {
    var l = u && local(u);
    if (l) { location.href = l; return null; }
    return open.apply(window, arguments);
  };
})();
