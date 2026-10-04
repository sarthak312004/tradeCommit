// index.html starts the first API requests (auth check, journals, planners) while the JS bundle is
// still downloading and parsing, and parks the promises on window.__prefetch.
// These helpers hand each one to exactly one consumer; every later call makes a normal request.

/** Takes the early request for `name`, or null if it was never started or was already used. */
export const takePrefetched = (name) => {
  const store = window.__prefetch
  if (!store || !store[name]) return null
  const promise = store[name]
  delete store[name]
  return promise
}

/** Uses the early request when there is one, otherwise fetches `url` now. Always returns a Response. */
export const fetchPrefetched = async (name, url) => {
  const early = takePrefetched(name)
  if (early) {
    const response = await early
    if (response) return response // null means the early request hit a network error: retry below
  }
  return fetch(url, { credentials: 'include' })
}
