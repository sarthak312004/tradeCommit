import { useEffect, useRef, useState } from "react"
import { fetchAuthConfig } from "../../services/authApi"

const GIS_SRC = "https://accounts.google.com/gsi/client"
const MAX_WIDTH = 400 // Google caps the button width at 400px

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
  const holderRef = useRef(null)
  const onCredentialRef = useRef(onCredential)

  useEffect(() => {
    onCredentialRef.current = onCredential
  })

  useEffect(() => {
    let cancelled = false
    fetchAuthConfig().then((config) => !cancelled && setClientId(config.googleClientId))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holderRef.current) return
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
          width: Math.min(MAX_WIDTH, holderRef.current.clientWidth || MAX_WIDTH),
        })
      })
      .catch(() => {
        /* script blocked or offline: email sign-in still works */
      })

    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <>
      <div
        ref={holderRef}
        aria-label="Continue with Google"
        className={`flex min-h-[44px] justify-center transition-opacity ${disabled ? "pointer-events-none opacity-50" : ""}`}
      />
      <div className="my-5 flex items-center gap-3 text-xs text-[#566274]" aria-hidden="true">
        <span className="h-px flex-1 bg-[#27313f]" />
        or
        <span className="h-px flex-1 bg-[#27313f]" />
      </div>
    </>
  )
}
