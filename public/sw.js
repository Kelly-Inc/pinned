// The vendored Pinterest client registers a service worker. Keep it a no-op so
// local development does not serve stale shell/API responses from a cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
