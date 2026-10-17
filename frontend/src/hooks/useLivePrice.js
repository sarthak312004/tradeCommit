import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchQuote } from '../services/marketApi'

const MIN_LENGTH = 2

/**
 * Live price for the symbol being typed.
 *   - waits for a pause in typing (debounce), cancels the request it replaces
 *   - keeps the price fresh every `pollMs` while the tab is visible (the previous price stays on screen meanwhile)
 *   - `lookup` = { symbol, exact }: pass the provider id with exact=true when the user picked a suggestion
 * Returns { quote, status: 'idle' | 'loading' | 'ready' | 'error', error, isFetching, refresh }.
 */
export function useLivePrice({ symbol, exact = false, prefer = 'GLOBAL', enabled = true, debounceMs = 450, pollMs = 20000 }) {
  const clean = String(symbol ?? '').trim().toUpperCase()
  const active = enabled && clean.length >= MIN_LENGTH
  const requestKey = active ? `${clean}|${exact ? 'x' : 'r'}|${prefer}` : ''

  const [result, setResult] = useState({ key: '', quote: null, error: '' })
  const [isFetching, setIsFetching] = useState(false)
  const runRef = useRef(null)

  useEffect(() => {
    if (!requestKey) return undefined

    let cancelled = false
    let controller = null

    const run = async () => {
      controller?.abort()
      controller = new AbortController()
      setIsFetching(true)
      try {
        const quote = await fetchQuote(clean, { prefer, exact, signal: controller.signal })
        if (!cancelled) setResult({ key: requestKey, quote, error: '' })
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return
        // a failed refresh keeps the last good price; a failed first lookup shows the message
        setResult((previous) => (previous.key === requestKey && previous.quote ? previous : { key: requestKey, quote: null, error: error.message || 'Could not fetch the price' }))
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }

    runRef.current = run
    const first = setTimeout(run, debounceMs)
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') run()
    }, pollMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      controller?.abort()
      clearTimeout(first)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      runRef.current = null
    }
  }, [requestKey, clean, exact, prefer, debounceMs, pollMs])

  const refresh = useCallback(() => runRef.current?.(), [])

  // only ever show a result that belongs to what is typed right now
  const current = result.key === requestKey ? result : null
  const status = !active ? 'idle' : current?.quote ? 'ready' : current?.error ? 'error' : 'loading'

  return { quote: current?.quote ?? null, status, error: current?.error ?? '', isFetching, refresh }
}
