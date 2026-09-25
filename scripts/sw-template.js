/*
 * I'M DOG? service worker. Generated at build time from scripts/sw-template.js by the
 * im-dog:service-worker plugin in vite.config.ts; see docs/MOBILE.md.
 *
 * - Install: precache every file of this build, so repeat visits load fast and the game plays offline.
 * - The cache name comes from a hash of the build's files: a new deploy gets a new cache, and old ones are
 *   deleted when it activates. No manual version bumps, and no stale mix of old and new files.
 * - Pages (navigations): network first, so a new version shows as soon as the player is online; the cached
 *   page when offline.
 * - Everything else: cache first (built files have content-hashed names), else the network.
 */
const CACHE = 'im-dog-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('im-dog-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE).then((cache) => cache.match('./')).then((hit) => hit || Response.error()),
      ),
    );
    return;
  }
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request, { ignoreSearch: true }))
      .then((hit) => hit || fetch(request)),
  );
});
