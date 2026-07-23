// Flashread offline service worker: cache-first with network fallback, so the
// reader keeps working with no connection once the shell has loaded.
const CACHE = 'flashread-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then(
        (hit) =>
          hit ||
          fetch(req)
            .then((res) => {
              try {
                if (res && res.ok && new URL(req.url).origin === self.location.origin) {
                  cache.put(req, res.clone())
                }
              } catch {
                /* opaque / cross-origin — skip caching */
              }
              return res
            })
            .catch(() => hit),
      ),
    ),
  )
})
