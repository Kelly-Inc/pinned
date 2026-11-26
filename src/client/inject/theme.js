// Runs before the app boots. The client only renders dark mode when its boot
// context says so, and its own theme cookie is Secure-only (dropped on plain
// http). Read the theme it saved in localStorage and patch the boot JSON.
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (!t) return;
    var h = new Date().getHours();
    var dark = t === 'dark'
      || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
      || (t === 'daynight' && (h >= 18 || h < 6));
    var el = document.getElementById('__PWS_DATA__');
    if (!el) return;
    var data = JSON.parse(el.textContent);
    data.context.theme = dark ? 'dark' : 'light';
    el.textContent = JSON.stringify(data);
  } catch (e) { /* never block boot */ }
})();
