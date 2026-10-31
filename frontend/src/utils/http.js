// Small fetch helpers shared by the API services.

/** Unwraps the `{ data }` envelope of ApiResponse; signals the app when the session has expired. */
export const readJson = async (response) => {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth-expired'))
    const error = new Error(payload?.message ?? 'Request failed')
    error.status = response.status
    error.retryAfter = response.headers.get('Retry-After')
    // false when a proxy answered instead of our API (for example a gateway timeout page), so callers can tell the two apart
    error.fromApi = payload !== null
    throw error
  }
  return payload?.data
}

/**
 * Sends a JSON request with the session cookie and returns the unwrapped data.
 * `timeoutMs` (optional) stops waiting after that long; the error then has `timedOut: true` and status 504.
 */
export const requestJson = async (url, { method = 'GET', body, cache, timeoutMs } = {}) => {
  const controller = timeoutMs ? new AbortController() : null
  let timedOut = false
  const timer = controller
    ? setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
    : null
  try {
    const response = await fetch(url, {
      method,
      cache,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal
    })
    return await readJson(response)
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error('The request took too long.')
      timeoutError.status = 504
      timeoutError.timedOut = true
      throw timeoutError
    }
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}
