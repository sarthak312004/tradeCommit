import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INSTALL_DISMISSED_KEY,
  INSTALLED_FLAG_KEY,
  createPwaStore,
  detectInstallPlatform,
  isStandaloneDisplay,
  shouldRegisterServiceWorker,
} from './pwa.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(here, '../../public')

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key),
  }
}

test('shouldRegisterServiceWorker registers only in production on HTTPS or localhost', () => {
  assert.equal(
    shouldRegisterServiceWorker({
      isProd: false,
      hasServiceWorker: true,
      isSecureContext: true,
      protocol: 'https:',
      hostname: 'tradecommit.app',
    }),
    false
  )
  assert.equal(
    shouldRegisterServiceWorker({
      isProd: true,
      hasServiceWorker: false,
      isSecureContext: true,
      protocol: 'https:',
      hostname: 'tradecommit.app',
    }),
    false
  )
  assert.equal(
    shouldRegisterServiceWorker({
      isProd: true,
      hasServiceWorker: true,
      isSecureContext: false,
      protocol: 'http:',
      hostname: 'example.com',
    }),
    false
  )
  assert.equal(
    shouldRegisterServiceWorker({
      isProd: true,
      hasServiceWorker: true,
      isSecureContext: true,
      protocol: 'https:',
      hostname: 'tradecommit.app',
    }),
    true
  )
  assert.equal(
    shouldRegisterServiceWorker({
      isProd: true,
      hasServiceWorker: true,
      isSecureContext: false,
      protocol: 'http:',
      hostname: 'localhost',
    }),
    true
  )
})

test('detectInstallPlatform identifies Windows/Android Chromium, macOS Safari, iOS/iPadOS, and unsupported browsers', () => {
  const winChrome = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    platform: 'Win32',
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(winChrome.method, 'chromium-desktop')
  assert.equal(winChrome.canInstall, true)
  assert.equal(winChrome.supportsNativePrompt, true)

  const androidChrome = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(androidChrome.method, 'chromium-android')
  assert.equal(androidChrome.canInstall, true)
  assert.equal(androidChrome.supportsNativePrompt, true)

  const macSafari = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 0,
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(macSafari.method, 'macos-safari-manual')
  assert.equal(macSafari.canInstall, true)
  assert.equal(macSafari.supportsNativePrompt, false)
  assert.ok(macSafari.steps.some((step) => step.includes('Add to Dock')))

  const iosSafari = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(iosSafari.method, 'ios-manual')
  assert.equal(iosSafari.canInstall, true)
  assert.equal(iosSafari.supportsNativePrompt, false)
  assert.ok(iosSafari.steps.some((step) => step.includes('Add to Home Screen')))

  const ipadDesktopMode = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5,
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(ipadDesktopMode.method, 'ios-manual')
  assert.equal(ipadDesktopMode.canInstall, true)

  const desktopFirefox = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    platform: 'Win32',
    isSecureContext: true,
    protocol: 'https:',
  })
  assert.equal(desktopFirefox.method, 'unsupported')
  assert.equal(desktopFirefox.canInstall, false)
  assert.equal(desktopFirefox.supportsNativePrompt, false)

  const insecureHttp = detectInstallPlatform({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
    platform: 'Win32',
    isSecureContext: false,
    protocol: 'http:',
    hostname: 'tradecommit.example.com',
  })
  assert.equal(insecureHttp.method, 'insecure')
  assert.equal(insecureHttp.canInstall, false)
})

test('isStandaloneDisplay detects iOS navigator.standalone and display-mode media queries', () => {
  assert.equal(isStandaloneDisplay(null), false)
  assert.equal(isStandaloneDisplay({ navigator: { standalone: true } }), true)
  assert.equal(
    isStandaloneDisplay({
      navigator: {},
      matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }),
    }),
    true
  )
})

test('createPwaStore handles beforeinstallprompt, dismissal persistence, and manual fallback', async () => {
  const storage = createMemoryStorage()
  const store = createPwaStore({
    storage,
    platformInfo: detectInstallPlatform({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Version/17.5 Safari/605.1.15',
      platform: 'MacIntel',
      isSecureContext: true,
      protocol: 'https:',
    }),
    initialStandalone: false,
  })

  // Without deferredPrompt, requestInstall opens manual instructions dialog
  const fallbackResult = await store.requestInstall()
  assert.equal(fallbackResult.outcome, 'manual-instructions')
  assert.equal(store.getSnapshot().isInstallDialogOpen, true)

  store.closeInstallDialog()
  assert.equal(store.getSnapshot().isInstallDialogOpen, false)

  // Dismissal persists to storage
  store.dismissInstallEntry()
  assert.equal(store.getSnapshot().installDismissed, true)
  assert.equal(storage.getItem(INSTALL_DISMISSED_KEY), '1')

  // With deferredPrompt, requestInstall triggers prompt() and records accepted install
  let promptCalled = 0
  store.setDeferredPrompt({
    prompt: async () => {
      promptCalled += 1
    },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  })
  assert.equal(store.getSnapshot().canPromptNatively, true)

  const acceptedResult = await store.requestInstall()
  assert.equal(promptCalled, 1)
  assert.equal(acceptedResult.outcome, 'accepted')
  assert.equal(store.getSnapshot().isInstalled, true)
  assert.equal(storage.getItem(INSTALLED_FLAG_KEY), '1')
})

test('createPwaStore waiting worker update lifecycle never reloads without explicit user action', () => {
  let reloaded = 0
  let postedMessage = null
  const store = createPwaStore({
    storage: createMemoryStorage(),
    onReload: () => {
      reloaded += 1
    },
  })

  const fakeWorker = {
    postMessage: (msg) => {
      postedMessage = msg
    },
  }

  store.setWaitingWorker(fakeWorker)
  assert.equal(store.getSnapshot().updateAvailable, true)
  assert.equal(store.getSnapshot().updateDismissed, false)

  // Controller change before user clicks Update must NOT reload
  store.handleControllerChange()
  assert.equal(reloaded, 0)

  // Dismissing hides the notification without activating the worker
  store.dismissUpdate()
  assert.equal(store.getSnapshot().updateDismissed, true)
  assert.equal(postedMessage, null)

  // Applying update sends SKIP_WAITING and reloads once on controllerchange
  const applied = store.applyUpdate()
  assert.equal(applied, true)
  assert.deepEqual(postedMessage, { type: 'SKIP_WAITING' })
  assert.equal(store.getSnapshot().isApplyingUpdate, true)

  store.handleControllerChange()
  store.handleControllerChange()
  assert.equal(reloaded, 1)
})

test('manifest, icons, offline page, and service worker enforce branding and privacy invariants', () => {
  const manifestPath = path.join(publicDir, 'manifest.webmanifest')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  assert.equal(manifest.name, 'TradeCommit')
  assert.equal(manifest.short_name, 'TradeCommit')
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'standalone')

  const sizes = new Set(manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`))
  assert.ok(sizes.has('192x192:any'))
  assert.ok(sizes.has('512x512:any'))
  assert.ok(sizes.has('192x192:maskable'))
  assert.ok(sizes.has('512x512:maskable'))

  for (const icon of manifest.icons) {
    const iconFile = path.join(publicDir, icon.src.replace(/^\//, ''))
    assert.ok(fs.existsSync(iconFile), `Missing manifest icon file: ${icon.src}`)
    const stat = fs.statSync(iconFile)
    assert.ok(stat.size > 100, `Icon file ${icon.src} is unexpectedly empty`)
  }

  const swCode = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8')
  assert.ok(swCode.includes("url.pathname.startsWith('/api/')"), 'Service worker must exclude /api/ paths')
  assert.ok(swCode.includes("request.method !== 'GET'"), 'Service worker must ignore non-GET requests')
  assert.ok(swCode.includes("event.data.type === 'SKIP_WAITING'"), 'Service worker must wait for SKIP_WAITING message')
})

test('service worker runtime behavior: caches static shell, serves offline fallback on navigation failure, and never caches /api/* data', async () => {
  const swCode = fs.readFileSync(path.join(publicDir, 'sw.js'), 'utf8')
  const listeners = new Map()
  const cacheBuckets = new Map()
  let skipWaitingCalls = 0
  let claimCalls = 0
  let networkOnline = true

  const getBucket = (name) => {
    if (!cacheBuckets.has(name)) cacheBuckets.set(name, new Map())
    return cacheBuckets.get(name)
  }

  // Pre-seed a stale cache to verify activate cleanup
  getBucket('tradecommit-shell-oldversion').set('/old.js', new Response('old'))

  const fakeCaches = {
    open: async (name) => {
      const bucket = getBucket(name)
      return {
        put: async (reqOrUrl, res) => {
          const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url, 'https://tradecommit.app').pathname
          bucket.set(key, res)
        },
        match: async (reqOrUrl) => {
          const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url, 'https://tradecommit.app').pathname
          return bucket.get(key) || null
        },
      }
    },
    keys: async () => [...cacheBuckets.keys()],
    delete: async (name) => cacheBuckets.delete(name),
  }

  const makeBasicResponse = (body, contentType = 'text/html; charset=utf-8', extraHeaders = {}) => {
    const res = new Response(body, {
      status: 200,
      headers: { 'content-type': contentType, ...extraHeaders },
    })
    Object.defineProperty(res, 'type', { value: 'basic' })
    return res
  }

  const fakeFetch = async (input) => {
    if (!networkOnline) throw new TypeError('Failed to fetch')
    const rawUrl = typeof input === 'string' ? input : input.url
    const parsed = new URL(rawUrl, 'https://tradecommit.app')
    if (parsed.pathname === '/offline.html') {
      return makeBasicResponse('<!doctype html><title>Offline — TradeCommit</title>')
    }
    if (parsed.pathname === '/' || parsed.pathname === '/index.html') {
      return makeBasicResponse('<!doctype html><div id="root"></div>')
    }
    return makeBasicResponse('asset', 'image/png')
  }

  const fakeSelf = {
    location: new URL('https://tradecommit.app/sw.js'),
    addEventListener: (type, handler) => listeners.set(type, handler),
    skipWaiting: () => {
      skipWaitingCalls += 1
    },
    clients: {
      claim: async () => {
        claimCalls += 1
      },
    },
  }

  class FakeRequest {
    constructor(u, opts = {}) {
      this.url = new URL(u, 'https://tradecommit.app').href
      this.method = opts.method || 'GET'
      this.mode = opts.mode || 'cors'
      this.headers = new Headers(opts.headers || {})
    }
  }

  const runSw = new Function('self', 'caches', 'fetch', 'Request', 'Response', 'URL', swCode)
  runSw(fakeSelf, fakeCaches, fakeFetch, FakeRequest, Response, URL)

  // 1. Install: populates static shell cache and does NOT call skipWaiting() automatically
  let installPromise = null
  listeners.get('install')({
    waitUntil: (p) => {
      installPromise = p
    },
  })
  await installPromise
  assert.equal(skipWaitingCalls, 0)

  // 2. Message SKIP_WAITING: triggers skipWaiting() only when requested
  listeners.get('message')({ data: { type: 'SKIP_WAITING' } })
  assert.equal(skipWaitingCalls, 1)

  // 3. Activate: removes stale tradecommit-shell-oldversion cache and claims clients
  let activatePromise = null
  listeners.get('activate')({
    waitUntil: (p) => {
      activatePromise = p
    },
  })
  await activatePromise
  assert.equal(cacheBuckets.has('tradecommit-shell-oldversion'), false)
  assert.equal(claimCalls, 1)

  // 4. Private API requests (/api/v1/journals, /api/v1/auth/profile, POST mutations) are NEVER intercepted or cached
  const privateRequests = [
    { url: 'https://tradecommit.app/api/v1/journals', method: 'GET', mode: 'cors', headers: new Headers() },
    { url: 'https://tradecommit.app/api/v1/auth/profile', method: 'GET', mode: 'cors', headers: new Headers() },
    { url: 'https://tradecommit.app/api/v1/planners', method: 'GET', mode: 'cors', headers: new Headers() },
    { url: 'https://tradecommit.app/api/v1/journals/123/trades', method: 'POST', mode: 'cors', headers: new Headers() },
  ]

  for (const request of privateRequests) {
    let intercepted = false
    listeners.get('fetch')({
      request,
      respondWith: () => {
        intercepted = true
      },
    })
    assert.equal(intercepted, false, `Service worker must not intercept ${request.method} ${request.url}`)
  }

  for (const bucket of cacheBuckets.values()) {
    for (const key of bucket.keys()) {
      assert.ok(!key.startsWith('/api'), `Cache must never contain API path: ${key}`)
    }
  }

  // 5. Offline navigation: serves cached shell / offline fallback when network is unavailable
  networkOnline = false
  let navResponsePromise = null
  listeners.get('fetch')({
    request: {
      url: 'https://tradecommit.app/planner/abc',
      method: 'GET',
      mode: 'navigate',
      headers: new Headers({ accept: 'text/html' }),
    },
    respondWith: (p) => {
      navResponsePromise = p
    },
  })
  assert.ok(navResponsePromise, 'Navigation request must be handled by service worker')
  const navResponse = await navResponsePromise
  assert.equal(navResponse.status, 200)
})

