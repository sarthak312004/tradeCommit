const API_BASE = "/api/v1/auth" // proxied to the backend in dev (vite) and in production (vercel rewrite)

/** POSTs JSON with the session cookie. Resolves to the `{ data, message }` envelope, throws Error(message) otherwise. */
export async function authPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    credentials: "include", // lets the browser store the httpOnly auth cookies
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new Error(payload?.message || `Something went wrong (${res.status}). Try again.`)
  }
  return payload
}

/** Public auth settings (currently just the Google client id, null when Google sign-in is off). */
export async function fetchAuthConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`, { credentials: "include" })
    if (!res.ok) return { googleClientId: null }
    const payload = await res.json()
    return { googleClientId: payload?.data?.googleClientId ?? null }
  } catch {
    return { googleClientId: null }
  }
}
