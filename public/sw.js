// Flashread offline service worker.
// - Navigations (the HTML document): network-first, so a new deploy always wins
//   and you never get stuck on a stale shell; falls back to cache when offline.
// - Other same-origin GETs (hashed JS/CSS/fonts, icons): cache-first, since Vite
//   fingerprints them and they never change under a given URL.
// Bump CACHE to invalidate everything on the next visit.
const CACHE = 'flashread-v3'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  const isNavigation =
    req.mode === 'navigate' || (req.destination === 'document')

  if (isNavigation) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {})
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./'))),
    )
    return
  }

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
