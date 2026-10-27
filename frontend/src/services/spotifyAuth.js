const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const ACCESS_TOKEN_KEY = "spotify-access-token"
const REFRESH_TOKEN_KEY = "spotify-refresh-token"
const EXPIRY_KEY = "spotify-token-expiry"
const STATE_KEY = "spotify-oauth-state"
const VERIFIER_KEY = "spotify-oauth-verifier"
const RETURN_TO_KEY = "spotify-oauth-return-to"
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/spotify/callback`
const SCOPES = [
  "streaming",
  "user-read-private",
  "user-read-email",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ")

const encodeBase64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const createRandomString = (length = 64) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return encodeBase64Url(bytes)
}

const createCodeChallenge = async (verifier) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return encodeBase64Url(digest)
}

const saveTokens = (tokens) => {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + tokens.expires_in * 1000))
  if (tokens.refresh_token) sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

const tokenRequest = async (body) => {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error_description || "Spotify authorization failed.")
  return payload
}

export const isSpotifyConfigured = () => Boolean(CLIENT_ID)

export const beginSpotifyAuthorization = async () => {
  if (!CLIENT_ID) throw new Error("Spotify playback is not configured for this app.")
  const verifier = createRandomString()
  const state = createRandomString(24)
  const challenge = await createCodeChallenge(verifier)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(RETURN_TO_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`)

  const authorizationUrl = new URL("https://accounts.spotify.com/authorize")
  authorizationUrl.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString()
  window.location.assign(authorizationUrl)
}

export const completeSpotifyAuthorization = async (search) => {
  const params = new URLSearchParams(search)
  const code = params.get("code")
  const state = params.get("state")
  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY) || "/"

  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(RETURN_TO_KEY)

  if (params.has("error")) throw new Error("Spotify access was not approved.")
  if (!code || !state || state !== expectedState || !verifier) {
    throw new Error("Spotify authorization could not be verified. Please try connecting again.")
  }

  const tokens = await tokenRequest({
    client_id: CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })
  saveTokens(tokens)
  return returnTo
}

export const disconnectSpotify = () => {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(EXPIRY_KEY)
}

export const getSpotifyAccessToken = async () => {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  const expiresAt = Number(sessionStorage.getItem(EXPIRY_KEY) || 0)
  if (token && expiresAt > Date.now() + 60_000) return token

  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken || !CLIENT_ID) {
    disconnectSpotify()
    throw new Error("Connect your Spotify account to use playback controls.")
  }

  const refreshed = await tokenRequest({
    client_id: CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
  saveTokens(refreshed)
  return refreshed.access_token
}
