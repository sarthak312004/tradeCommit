import { useEffect, useRef, useState } from "react"
import { fetchAuthConfig } from "../../services/authApi"

const GIS_SRC = "https://accounts.google.com/gsi/client"
const MAX_WIDTH = 400 // Google caps its button at 400px

let gisScriptPromise = null
const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve()
  gisScriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = GIS_SRC
    script.async = true
    script.onload = resolve
    script.onerror = () => {
      gisScriptPromise = null
      reject(new Error("Could not load Google sign-in"))
    }
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

// The config is fetched once per page load, and Google is initialised once, however often the tabs are switched.
let configPromise = null
const loadConfig = () => {
  configPromise ??= fetchAuthConfig().then((config) => {
    if (!config.googleClientId) configPromise = null // try again next time
    return config
  })
  return configPromise
}

let initializedFor = null
let activeHandler = null
const ensureInitialized = (clientId) => {
  if (initializedFor === clientId) return
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => response?.credential && activeHandler?.(response.credential),
  })
  initializedFor = clientId
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * "Sign in with Google" for the LOGIN form only (the backend does not create accounts from Google).
 *
 * The look is our own (same as the app's inputs and buttons). Google's real button is rendered on top of it,
 * invisible, so the click still goes through Google's official, policy-compliant button.
 * Renders nothing unless the backend has GOOGLE_CLIENT_ID configured.
 *
 * @param {Function} onCredential  (idToken: string) => void
 * @param {boolean}  [disabled]    blocks the button while another request is running
 */
export default function GoogleButton({ onCredential, disabled = false }) {
  const [clientId, setClientId] = useState(undefined) // undefined = still checking, null = Google sign-in is off
  const holderRef = useRef(null)
  const onCredentialRef = useRef(onCredential)

  useEffect(() => {
    onCredentialRef.current = onCredential
  })

  useEffect(() => {
    let cancelled = false
    loadConfig().then((config) => !cancelled && setClientId(config.googleClientId))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    let resizeTimer

    const handler = (credential) => onCredentialRef.current(credential)
    activeHandler = handler

    const draw = () => {
      const holder = holderRef.current
      if (cancelled || !holder || !window.google?.accounts?.id) return
      holder.innerHTML = ""
      window.google.accounts.id.renderButton(holder, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: Math.min(MAX_WIDTH, Math.round(holder.clientWidth) || MAX_WIDTH),
      })
    }

    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(draw, 150)
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled) return
        ensureInitialized(clientId)
        draw()
        window.addEventListener("resize", onResize)
      })
      .catch(() => {
        /* script blocked or offline: email sign-in still works */
      })

    return () => {
      cancelled = true
      clearTimeout(resizeTimer)
      window.removeEventListener("resize", onResize)
      if (activeHandler === handler) activeHandler = null
    }
  }, [clientId])

  if (clientId === null) return null

  return (
    <>
      {clientId === undefined ? (
        <div className="h-10 animate-pulse rounded-md bg-zinc-200/70 dark:bg-white/[0.06]" aria-hidden="true" />
      ) : (
        <div className={`group relative h-10 w-full transition-opacity ${disabled ? "pointer-events-none opacity-50" : ""}`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2.5 rounded-md border border-zinc-300/80 bg-white text-sm font-medium text-zinc-800 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-white/10 dark:bg-[#202020] dark:text-zinc-100 dark:group-hover:bg-[#262626]"
          >
            <GoogleLogo />
            Sign in with Google
          </div>
          {/* Google's own button, stretched over ours and invisible: it receives the click */}
          <div ref={holderRef} className="absolute inset-0 z-10 overflow-hidden opacity-[0.01]" />
        </div>
      )}
      <div className="my-5 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500" aria-hidden="true">
        <span className="h-px flex-1 bg-zinc-300/70 dark:bg-white/[0.08]" />
        or
        <span className="h-px flex-1 bg-zinc-300/70 dark:bg-white/[0.08]" />
      </div>
    </>
  )
}
