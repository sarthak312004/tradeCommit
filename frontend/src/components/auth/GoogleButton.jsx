import { useEffect, useRef, useState } from "react"
import { fetchAuthConfig } from "../../services/authApi"

const GIS_SRC = "https://accounts.google.com/gsi/client"
const MIN_WIDTH = 200
const MAX_WIDTH = 400

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

/**
 * Official "Continue with Google" button (Google Identity Services).
 * Renders nothing unless the backend has GOOGLE_CLIENT_ID configured.
 *
 * @param {Function} onCredential  (idToken: string) => void
 * @param {boolean}  [disabled]    dims and blocks the button while another request is running
 */
export default function GoogleButton({ onCredential, disabled = false }) {
  const [clientId, setClientId] = useState(null)
  const [buttonWidth, setButtonWidth] = useState(0)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [scriptFailed, setScriptFailed] = useState(false)
  const holderRef = useRef(null)
  const onCredentialRef = useRef(onCredential)

  useEffect(() => {
    onCredentialRef.current = onCredential
  })

  useEffect(() => {
    let cancelled = false
    fetchAuthConfig()
      .then((config) => {
        if (!cancelled) setClientId(config.googleClientId)
      })
      .catch(() => {
        if (!cancelled) setClientId(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const holder = holderRef.current
    if (!clientId || !holder) return undefined

    const observer = new ResizeObserver(() => {
      const width = holder.clientWidth
      setButtonWidth((previous) => (previous === width ? previous : width))
    })
    observer.observe(holder)

    return () => observer.disconnect()
  }, [clientId])

  useEffect(() => {
    if (!clientId || buttonWidth === 0) return undefined
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        const holder = holderRef.current
        if (cancelled || !holder) return
        holder.innerHTML = ""
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => response?.credential && onCredentialRef.current(response.credential),
        })
        window.google.accounts.id.renderButton(holderRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, buttonWidth)),
        })
        setScriptLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setScriptFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [clientId, buttonWidth])

  if (!clientId || scriptFailed) return null

  return (
    <>
      <div
        className={`relative h-[44px] w-full overflow-hidden rounded-lg ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <div ref={holderRef} aria-label="Continue with Google" className="h-full w-full" />
        {!scriptLoaded && (
          <div className="absolute inset-0 animate-pulse rounded-lg border border-[#27313f] bg-[#0d1219]" aria-hidden="true" />
        )}
      </div>
      <div className="my-5 flex items-center gap-3 text-xs text-[#566274]" aria-hidden="true">
        <span className="h-px flex-1 bg-[#27313f]" />
        or
        <span className="h-px flex-1 bg-[#27313f]" />
      </div>
    </>
  )
}
