// TradeCommit Production Service Worker
// Caches only safe static app-shell assets. Never caches or intercepts /api/* routes,
// authenticated responses, credentials, cookies, or private user/journal/planner data.
// Never calls skipWaiting() automatically; activates waiting updates only on explicit user action.

const CACHE_VERSION = '__SW_CACHE_VERSION__'
const CACHE_PREFIX = 'tradecommit-shell-'
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  '/icons.svg',
]

const PRECACHE_SET = new Set(PRECACHE_URLS)
const STATIC_ASSET_PATTERN = /^\/assets\/.+\.(?:js|css|svg|png|jpe?g|webp|woff2?|ttf|ico)$/i

function isNeverCachedRequest(request, url) {
  if (request.method !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return true
  if (url.pathname === '/sw.js') return true
  if (request.headers.has('authorization') || request.headers.has('range')) return true
  const accept = (request.headers.get('accept') || '').toLowerCase()
  if (accept.includes('application/json') && url.pathname !== '/manifest.webmanifest') return true
  return false
}

function isCacheableStaticPath(pathname) {
  return PRECACHE_SET.has(pathname) || STATIC_ASSET_PATTERN.test(pathname)
}

function isSafeStaticResponse(response, pathname) {
  if (!response || !response.ok || response.status !== 200 || response.type !== 'basic') return false
  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase()
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) return false
  if (response.headers.has('set-cookie')) return false
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json') && pathname !== '/manifest.webmanifest') return false
  return true
}

self.addEventListener('install', (event) => {
  // Deliberately do NOT call self.skipWaiting() here.
  // If an existing service worker controls the page, this new worker stays in the `waiting`
  // state until the user explicitly clicks "Update" in the UI.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await Promise.all(
        PRECACHE_URLS.map(async (assetUrl) => {
          try {
            const response = await fetch(new Request(assetUrl, { cache: 'reload', credentials: 'omit' }))
            if (isSafeStaticResponse(response, assetUrl)) {
              await cache.put(assetUrl, response)
            }
          } catch {
            // Individual asset failure does not abort service worker installation
          }
        })
      )
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Never intercept API calls, non-GET mutations, or cross-origin requests.
  if (isNeverCachedRequest(request, url)) {
    return
  }

  // HTML navigation requests: Network-first with cached app-shell / offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request)
          if (isSafeStaticResponse(networkResponse, '/index.html')) {
            const cache = await caches.open(CACHE_NAME)
            cache.put('/index.html', networkResponse.clone()).catch(() => {})
          }
          return networkResponse
        } catch {
          const cache = await caches.open(CACHE_NAME)
          if (url.pathname === '/offline.html') {
            const directOffline = await cache.match('/offline.html')
            if (directOffline) return directOffline
          }
          const cachedShell = (await cache.match('/index.html')) || (await cache.match('/'))
          if (cachedShell) return cachedShell
          const offlineFallback = await cache.match('/offline.html')
          if (offlineFallback) return offlineFallback
          return new Response('You are offline.', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }
      })()
    )
    return
  }

  // Only intercept whitelisted static app-shell assets.
  if (!isCacheableStaticPath(url.pathname)) {
    return
  }

  // Hashed Vite assets under /assets/ are immutable: Cache-first, falling back to network.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        if (cached) return cached
        const networkResponse = await fetch(request)
        if (isSafeStaticResponse(networkResponse, url.pathname)) {
          cache.put(request, networkResponse.clone()).catch(() => {})
        }
        return networkResponse
      })()
    )
    return
  }

  // Public shell assets (icons, manifest, offline.html): Stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(url.pathname) || await cache.match(request)
      const networkPromise = fetch(request)
        .then((networkResponse) => {
          if (isSafeStaticResponse(networkResponse, url.pathname)) {
            cache.put(url.pathname, networkResponse.clone()).catch(() => {})
          }
          return networkResponse
        })
        .catch(() => null)

      if (cached) return cached
      const networkResponse = await networkPromise
      if (networkResponse) return networkResponse
      return new Response('', { status: 504, statusText: 'Offline' })
    })()
  )
})
