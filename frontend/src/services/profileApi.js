import { requestJson } from '../utils/http'

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
