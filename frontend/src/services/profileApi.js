import { readJson, requestJson } from '../utils/http'
import { moveTourState } from '../utils/productTour'

const BASE = '/api/v1/auth'
const post = (path, body = {}) => requestJson(`${BASE}${path}`, { method: 'POST', body })

// The profile never changes while the page is open, so every header (one per page) shares one request.
let cachedProfile = null

export const getProfile = () => {
  cachedProfile ??= requestJson(`${BASE}/profile`).catch((error) => {
    cachedProfile = null // let the next call retry
    throw error
  })
  return cachedProfile
}

export const clearProfileCache = () => {
  cachedProfile = null
}

export const PROFILE_UPDATED_EVENT = 'profile-updated'

/** Saves the name and/or username (sign-up no longer asks for them). Resolves to `{ fullname, username }`. */
export const updateProfile = async (changes) => {
  const previous = cachedProfile ? await Promise.resolve(cachedProfile).catch(() => null) : null
  const saved = await requestJson(`${BASE}/profile`, { method: 'PATCH', body: changes })
  if (previous?.username) moveTourState(previous.username, saved.username)
  cachedProfile = Promise.resolve({ ...(previous ?? {}), ...saved })
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT)) // every mounted profile hook re-reads the cache
  return saved
}

// A passwordless account that just chose a password has one from now on; no reload needed to see it.
const markPasswordSet = async () => {
  const previous = cachedProfile ? await Promise.resolve(cachedProfile).catch(() => null) : null
  if (!previous || previous.hasPassword) return
  cachedProfile = Promise.resolve({ ...previous, hasPassword: true })
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT))
}

/** The three password-change steps. Each one resolves to the server's `data` object. */
export const passwordApi = {
  sendCode: () => post('/password/send-otp'), // { email, sent, retryAfter }
  verifyCode: (otp) => post('/password/verify-otp', { otp }), // { resetToken }
  setPassword: async (resetToken, newPassword) => {
    const data = await post('/password/reset', { resetToken, newPassword })
    markPasswordSet() // the profile card switches from "Set a password" to "Reset password" right away
    return data
  },
}


/** The picture behind the page header. Both calls resolve to `{ headerBackdrop: { mode, scene, imageUrl } }`. */
export const headerBackdropApi = {
  save: (backdrop) => requestJson(`${BASE}/header-backdrop`, { method: 'PUT', body: backdrop }), // { mode: 'none' } or { mode: 'scene', scene }
  uploadImage: async (blob) => {
    const form = new FormData()
    form.append('image', blob, 'header.jpg')
    return readJson(await fetch(`${BASE}/header-backdrop/image`, { method: 'POST', credentials: 'include', body: form }))
  },
}

/** Playlist and focus palette preferences follow the signed-in account across sessions. */
export const saveFocusPreferences = async (preferences) => {
  const response = await requestJson(`${BASE}/focus-preferences`, { method: 'PUT', body: preferences })
  if (
    typeof response?.focusPreferences?.spotifyUrl !== 'string' ||
    !['sage', 'ocean', 'amber'].includes(response.focusPreferences.focusTheme)
  ) {
    throw new Error('The server returned an invalid focus preference response.')
  }
  if (cachedProfile) {
    cachedProfile = Promise.resolve(cachedProfile)
      .then((profile) => ({ ...profile, focusPreferences: response.focusPreferences }))
      .catch((error) => {
        cachedProfile = null
        throw error
      })
  }
  return response.focusPreferences
}
