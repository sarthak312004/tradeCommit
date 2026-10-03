// Small fetch helpers shared by the API services.

/** Unwraps the `{ data }` envelope of ApiResponse; signals the app when the session has expired. */
export const readJson = async (response) => {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('auth-expired'))
    throw new Error(payload?.message ?? 'Request failed')
  }
  return payload?.data
}

/** Sends a JSON request with the session cookie and returns the unwrapped data. */
export const requestJson = async (url, { method = 'GET', body } = {}) => {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return readJson(response)
}
