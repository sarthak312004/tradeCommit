import { readJson, requestJson } from '../utils/http'

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

/** The three password-change steps. Each one resolves to the server's `data` object. */
export const passwordApi = {
  sendCode: () => post('/password/send-otp'), // { email, sent, retryAfter }
  verifyCode: (otp) => post('/password/verify-otp', { otp }), // { resetToken }
  setPassword: (resetToken, newPassword) => post('/password/reset', { resetToken, newPassword }),
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
