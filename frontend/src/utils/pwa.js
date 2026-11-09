// Progressive Web App (PWA) state store, platform install detection, and production service-worker lifecycle.
// Designed with zero external dependencies and full testability under Node's test runner.

export const INSTALL_DISMISSED_KEY = 'tradecommit:pwa-install-dismissed'
export const INSTALLED_FLAG_KEY = 'tradecommit:pwa-installed'

export function isLocalhostHost(hostname = '') {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

export function isSecureOrigin({ isSecureContext = false, protocol = '', hostname = '' } = {}) {
  return Boolean(isSecureContext || protocol === 'https:' || isLocalhostHost(hostname))
}

export function shouldRegisterServiceWorker({
  isProd = false,
  hasServiceWorker = false,
  isSecureContext = false,
  protocol = '',
  hostname = '',
} = {}) {
  if (!isProd || !hasServiceWorker) return false
  return isSecureOrigin({ isSecureContext, protocol, hostname })
}

export function isStandaloneDisplay(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  try {
    if (win.navigator?.standalone === true) return true
    if (win.matchMedia?.('(display-mode: standalone)')?.matches) return true
    if (win.matchMedia?.('(display-mode: window-controls-overlay)')?.matches) return true
    if (win.matchMedia?.('(display-mode: minimal-ui)')?.matches) return true
  } catch {
    // ignore matchMedia errors in restricted environments
  }
  return false
}

/**
 * Classifies the current browser/OS and returns honest install capability and step-by-step instructions.
 * Never promises native one-click installation when the browser does not support it.
 */
export function detectInstallPlatform({
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  platform = typeof navigator !== 'undefined' ? navigator.platform : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true,
  protocol = typeof location !== 'undefined' ? location.protocol : 'https:',
  hostname = typeof location !== 'undefined' ? location.hostname : 'localhost',
} = {}) {
  const ua = String(userAgent || '')
  const plat = String(platform || '')
  const touchPoints = Number(maxTouchPoints) || 0

  const isIosDevice =
    /iPad|iPhone|iPod/i.test(ua) ||
    (/MacIntel/i.test(plat) && touchPoints > 1)
  const isAndroid = /Android/i.test(ua)
  const isMac = !isIosDevice && (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(plat))
  const isWindows = /Windows/i.test(ua) || /Win/i.test(plat)

  const isFirefox = /Firefox|FxiOS/i.test(ua)
  const isEdge = /Edg\/|EdgA\/|EdgiOS\//i.test(ua)
  const isOpera = /OPR\/|Opera/i.test(ua)
  const isChromium = (/Chrome\/|CriOS\/|Chromium\//i.test(ua) && !isFirefox) || isEdge || isOpera
  const isSafari = /Safari\//i.test(ua) && !isChromium && !isFirefox

  const secure = isSecureOrigin({ isSecureContext, protocol, hostname })
  const osLabel = isIosDevice
    ? 'iOS / iPadOS'
    : isAndroid
      ? 'Android'
      : isMac
        ? 'macOS'
        : isWindows
          ? 'Windows'
          : 'Desktop'

  if (!secure) {
    return {
      osLabel,
      browserLabel: 'Insecure HTTP',
      method: 'insecure',
      canInstall: false,
      supportsNativePrompt: false,
      title: 'HTTPS required to install TradeCommit',
      summary: 'Progressive Web App installation requires a secure HTTPS connection (or localhost in development).',
      steps: [
        'Open TradeCommit over https:// in a supported browser.',
        'Use the Install app button or your browser menu to install TradeCommit.',
      ],
    }
  }

  if (isIosDevice) {
    return {
      osLabel: 'iOS / iPadOS',
      browserLabel: isSafari ? 'Safari' : 'iOS Browser',
      method: 'ios-manual',
      canInstall: true,
      supportsNativePrompt: false,
      title: 'Install TradeCommit on iPhone or iPad',
      summary: 'iOS and iPadOS install web apps directly from the browser Share menu.',
      steps: [
        'Tap the Share button in your browser toolbar (the square with an upward arrow).',
        'Scroll the Share sheet and tap "Add to Home Screen".',
        'Tap "Add" in the top-right corner to place TradeCommit on your Home Screen.',
      ],
    }
  }

  if (isMac && isSafari) {
    return {
      osLabel: 'macOS',
      browserLabel: 'Safari',
      method: 'macos-safari-manual',
      canInstall: true,
      supportsNativePrompt: false,
      title: 'Install TradeCommit on macOS Safari',
      summary: 'Safari on macOS (Sonoma and newer) can add TradeCommit directly to your Dock as a standalone app.',
      steps: [
        'In the macOS menu bar, choose File → Add to Dock… (or click the Share button in the Safari toolbar and select Add to Dock…).',
        'Confirm the name TradeCommit and click Add.',
        'Launch TradeCommit anytime from your Dock or Spotlight.',
      ],
    }
  }

  if (isAndroid && isChromium) {
    return {
      osLabel: 'Android',
      browserLabel: isEdge ? 'Microsoft Edge' : 'Chrome',
      method: 'chromium-android',
      canInstall: true,
      supportsNativePrompt: true,
      title: 'Install TradeCommit on Android',
      summary: 'Install TradeCommit to open your journal and planner full-screen from your Home Screen.',
      steps: [
        'Tap the browser menu (⋮) in the top-right corner.',
        'Select "Install app" or "Add to Home screen".',
        'Tap "Install" to confirm.',
      ],
    }
  }

  if (isChromium) {
    return {
      osLabel,
      browserLabel: isEdge ? 'Microsoft Edge' : 'Chrome',
      method: 'chromium-desktop',
      canInstall: true,
      supportsNativePrompt: true,
      title: `Install TradeCommit on ${osLabel}`,
      summary: 'Run TradeCommit in its own dedicated window from your taskbar, Start menu, or Dock.',
      steps: isEdge
        ? [
            'Click the "App available" / Install icon in the right side of the address bar, or open the Edge menu (⋯).',
            'Select Apps → Install this site as an app.',
            'Click Install to launch TradeCommit in its own window.',
          ]
        : [
            'Click the Install TradeCommit icon in the right side of the address bar, or open the Chrome menu (⋮).',
            'Choose Save and share → Install page as app… (or Cast, save, and share → Install page as app…).',
            'Click Install to launch TradeCommit in its own window.',
          ],
    }
  }

  if (isAndroid && isFirefox) {
    return {
      osLabel: 'Android',
      browserLabel: 'Firefox',
      method: 'firefox-android',
      canInstall: true,
      supportsNativePrompt: false,
      title: 'Install TradeCommit on Android',
      summary: 'Firefox for Android can add TradeCommit to your Home Screen from the browser menu.',
      steps: [
        'Tap the browser menu (⋮) in Firefox.',
        'Tap "Install" or "Add app to Home screen".',
        'Confirm to add TradeCommit to your Home Screen.',
      ],
    }
  }

  return {
    osLabel,
    browserLabel: isFirefox ? 'Firefox' : 'Browser',
    method: 'unsupported',
    canInstall: false,
    supportsNativePrompt: false,
    title: 'Browser installation availability',
    summary:
      'This browser does not offer standalone web app installation. To install TradeCommit as an app, open it in Chrome or Microsoft Edge (Windows, macOS, Android), Safari on macOS, or Safari/Chrome on iOS & iPadOS.',
    steps: [
      'On Windows or Android: open TradeCommit in Google Chrome or Microsoft Edge and choose Install app.',
      'On macOS: open TradeCommit in Chrome, Edge, or Safari (File → Add to Dock…).',
      'On iPhone or iPad: open TradeCommit in Safari and tap Share → Add to Home Screen.',
    ],
  }
}

function readFlag(storage, key) {
  try {
    return storage?.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(storage, key, enabled) {
  try {
    if (!storage) return
    if (enabled) storage.setItem(key, '1')
    else storage.removeItem(key)
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export function createPwaStore({
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  platformInfo = detectInstallPlatform(),
  initialStandalone = isStandaloneDisplay(),
  initialOffline = typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  onReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  },
} = {}) {
  let deferredPrompt = null
  let waitingWorker = null
  let registration = null
  let userRequestedUpdate = false
  let hasReloadedForUpdate = false

  let state = {
    platform: platformInfo,
    isStandalone: Boolean(initialStandalone),
    isInstalled: Boolean(initialStandalone || readFlag(storage, INSTALLED_FLAG_KEY)),
    installDismissed: readFlag(storage, INSTALL_DISMISSED_KEY),
    canPromptNatively: false,
    isPromptingInstall: false,
    isInstallDialogOpen: false,
    updateAvailable: false,
    updateDismissed: false,
    isApplyingUpdate: false,
    isOffline: Boolean(initialOffline),
    offlineDismissed: false,
  }

  const listeners = new Set()
  const emit = () => {
    listeners.forEach((listener) => listener())
  }

  const setState = (patch) => {
    const next = { ...state, ...patch }
    state = next
    emit()
  }

  const setDeferredPrompt = (promptEvent) => {
    deferredPrompt = promptEvent || null
    setState({
      canPromptNatively: Boolean(deferredPrompt && typeof deferredPrompt.prompt === 'function'),
    })
  }

  const setStandalone = (isStandalone) => {
    const standalone = Boolean(isStandalone)
    if (standalone) {
      writeFlag(storage, INSTALLED_FLAG_KEY, true)
    }
    setState({
      isStandalone: standalone,
      isInstalled: standalone || state.isInstalled,
      isInstallDialogOpen: standalone ? false : state.isInstallDialogOpen,
    })
  }

  const markAppInstalled = () => {
    deferredPrompt = null
    writeFlag(storage, INSTALLED_FLAG_KEY, true)
    setState({
      isInstalled: true,
      canPromptNatively: false,
      isPromptingInstall: false,
      isInstallDialogOpen: false,
    })
  }

  const dismissInstallEntry = () => {
    writeFlag(storage, INSTALL_DISMISSED_KEY, true)
    setState({
      installDismissed: true,
      isInstallDialogOpen: false,
    })
  }

  const openInstallDialog = () => {
    setState({ isInstallDialogOpen: true })
  }

  const closeInstallDialog = () => {
    setState({ isInstallDialogOpen: false })
  }

  /**
   * Triggers native browser install prompt when available (`beforeinstallprompt`),
   * or opens the concise platform-specific manual installation instructions dialog.
   */
  const requestInstall = async () => {
    if (state.isStandalone) return { outcome: 'already-standalone' }

    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      const promptEvent = deferredPrompt
      deferredPrompt = null
      setState({ isPromptingInstall: true, canPromptNatively: false })
      try {
        await promptEvent.prompt()
        const choice = await (promptEvent.userChoice ?? Promise.resolve({ outcome: 'dismissed' }))
        const outcome = choice?.outcome || 'dismissed'
        if (outcome === 'accepted') {
          writeFlag(storage, INSTALLED_FLAG_KEY, true)
          setState({
            isInstalled: true,
            isPromptingInstall: false,
            isInstallDialogOpen: false,
          })
          return { outcome: 'accepted' }
        }
        setState({ isPromptingInstall: false })
        return { outcome: 'dismissed' }
      } catch {
        setState({ isPromptingInstall: false, isInstallDialogOpen: true })
        return { outcome: 'manual-fallback' }
      }
    }

    setState({ isInstallDialogOpen: true })
    return { outcome: 'manual-instructions' }
  }

  const setWaitingWorker = (worker) => {
    if (!worker) {
      waitingWorker = null
      setState({
        updateAvailable: false,
        isApplyingUpdate: false,
      })
      return
    }
    const isNewWorker = waitingWorker !== worker
    waitingWorker = worker
    setState({
      updateAvailable: true,
      updateDismissed: isNewWorker ? false : state.updateDismissed,
    })
  }

  const dismissUpdate = () => {
    setState({ updateDismissed: true })
  }

  const handleControllerChange = () => {
    if (!userRequestedUpdate || hasReloadedForUpdate) return
    hasReloadedForUpdate = true
    onReload()
  }

  const applyUpdate = () => {
    if (!waitingWorker) return false
    userRequestedUpdate = true
    setState({ isApplyingUpdate: true })
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      return true
    } catch {
      userRequestedUpdate = false
      setState({ isApplyingUpdate: false })
      return false
    }
  }

  const setOffline = (offline) => {
    const nextOffline = Boolean(offline)
    setState({
      isOffline: nextOffline,
      offlineDismissed: nextOffline ? state.offlineDismissed : false,
    })
  }

  const dismissOffline = () => {
    setState({ offlineDismissed: true })
  }

  const attachServiceWorkerRegistration = (reg, swContainer) => {
    registration = reg
    if (!reg) return

    if (reg.waiting) {
      setWaitingWorker(reg.waiting)
    }

    const watchInstalling = (installingWorker) => {
      if (!installingWorker) return
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') {
          // Only notify when an active controller already exists (i.e. this is an update, not first install).
          if (swContainer?.controller && reg.waiting) {
            setWaitingWorker(reg.waiting)
          } else if (swContainer?.controller) {
            setWaitingWorker(installingWorker)
          }
        }
      })
    }

    if (reg.installing) {
      watchInstalling(reg.installing)
    }

    reg.addEventListener('updatefound', () => {
      watchInstalling(reg.installing)
    })
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setDeferredPrompt,
    setStandalone,
    markAppInstalled,
    dismissInstallEntry,
    openInstallDialog,
    closeInstallDialog,
    requestInstall,
    setWaitingWorker,
    dismissUpdate,
    applyUpdate,
    handleControllerChange,
    setOffline,
    dismissOffline,
    attachServiceWorkerRegistration,
    getRegistration: () => registration,
  }
}

export const pwaStore = createPwaStore()

let initialized = false

export function initPwaClient() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  // Pick up any beforeinstallprompt captured by index.html before bundle hydration.
  if (window.__deferredInstallPrompt) {
    pwaStore.setDeferredPrompt(window.__deferredInstallPrompt)
    window.__deferredInstallPrompt = null
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    pwaStore.setDeferredPrompt(event)
  })

  window.addEventListener('appinstalled', () => {
    pwaStore.markAppInstalled()
  })

  try {
    const standaloneMedia = window.matchMedia?.('(display-mode: standalone)')
    standaloneMedia?.addEventListener?.('change', (event) => {
      pwaStore.setStandalone(event.matches || isStandaloneDisplay(window))
    })
  } catch {
    // ignore
  }

  window.addEventListener('online', () => pwaStore.setOffline(false))
  window.addEventListener('offline', () => pwaStore.setOffline(true))

  const canRegister = shouldRegisterServiceWorker({
    isProd: Boolean(import.meta.env?.PROD),
    hasServiceWorker: Boolean( typeof navigator !== 'undefined' && 'serviceWorker' in navigator),
    isSecureContext: Boolean(window.isSecureContext),
    protocol: window.location?.protocol || '',
    hostname: window.location?.hostname || '',
  })

  if (!canRegister) return

  const swContainer = navigator.serviceWorker
  swContainer.addEventListener('controllerchange', () => {
    pwaStore.handleControllerChange()
  })

  const registerWorker = async () => {
    try {
      const reg = await swContainer.register('/sw.js', { scope: '/' })
      pwaStore.attachServiceWorkerRegistration(reg, swContainer)
    } catch {
      // Service worker registration failure is non-fatal; app continues normally
    }
  }

  if (document.readyState === 'complete') {
    registerWorker()
  } else {
    window.addEventListener('load', registerWorker, { once: true })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pwaStore.getRegistration()?.update?.().catch?.(() => {})
    }
  })
}
