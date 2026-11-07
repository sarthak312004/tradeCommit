import { useEffect, useState } from 'react'
import { billingApi } from '../services/billingApi'
import { isLiveStatus } from '../utils/billingView'

/**
 * After checkout the webhook may arrive a few seconds late. While `enabled`, this asks GET /billing/status every
 * `intervalMs` for up to `timeoutMs`. It only watches: the plan changes when the server's state changes, never here.
 * Returns { phase: 'waiting' | 'active' | 'timeout', state }, and `restart()` to watch again.
 * `onActive(state)` runs once when the subscription shows up.
 */
export function useActivationPolling({ enabled, onActive, intervalMs = 2000, timeoutMs = 30000 }) {
  const [result, setResult] = useState({ phase: 'waiting', state: null })
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    let timer = null
    const startedAt = Date.now()

    const check = async () => {
      let state = null
      try {
        state = await billingApi.status()
      } catch {
        // a failed poll is not the end: try again until the time is up
      }
      if (cancelled) return
      if (state && isLiveStatus(state.status)) {
        setResult({ phase: 'active', state })
        onActive?.(state)
        return
      }
      if (Date.now() - startedAt >= timeoutMs) {
        setResult({ phase: 'timeout', state })
        return
      }
      timer = setTimeout(check, intervalMs)
    }

    timer = setTimeout(check, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, round, onActive, intervalMs, timeoutMs])

  const restart = () => {
    setResult({ phase: 'waiting', state: null })
    setRound((value) => value + 1)
  }

  return { ...result, restart }
}
