// Flashread offline service worker.
// - Navigations (the HTML document): network-first, so a new deploy always wins
//   and you never get stuck on a stale shell; falls back to cache when offline.
// - Other same-origin GETs (hashed JS/CSS/fonts, icons): cache-first, since Vite
//   fingerprints them and they never change under a given URL.
// Bump CACHE to invalidate everything on the next visit.
const CACHE = 'flashread-v8'

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

  // Leave cross-origin traffic alone. The neural voice pulls ~80MB of model
  // weights from Hugging Face and its WASM runtime from jsDelivr; routing those
  // through here bought nothing (they are never cached — wrong origin) and the
  // handler below answers a failed fetch with `undefined`, which respondWith
  // turns into a network error. On a phone dropping in and out of signal
  // mid-download, that killed the download outright.
  let sameOrigin = false
  try {
    sameOrigin = new URL(req.url).origin === self.location.origin
  } catch {
    sameOrigin = false
  }
  if (!sameOrigin) return

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
          // No cache entry to fall back on here, so a failed fetch has to reject
          // — resolving with `undefined` makes respondWith throw a bare network
          // error that hides what actually went wrong.
          fetch(req).then((res) => {
            if (res && res.ok) cache.put(req, res.clone()).catch(() => {})
            return res
          }),
      ),
    ),
  )
})
