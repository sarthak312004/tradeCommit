import { useEffect, useState } from 'react'
import { searchSymbols } from '../services/marketApi'

const cache = new Map() // survives re-opening the form, so retyping a symbol is instant

/** Autocomplete suggestions for the asset-name box. Results belong to `query`; stale ones are never shown. */
export function useSymbolSearch({ query, enabled = true, prefer = 'GLOBAL', debounceMs = 250 }) {
  const text = String(query ?? '').trim()
  const key = enabled && text.length >= 2 ? `${prefer}|${text.toLowerCase()}` : ''
  const [state, setState] = useState({ key: '', items: [] })

  useEffect(() => {
    if (!key) return undefined
    const cached = cache.get(key)
    if (cached) {
      const timer = setTimeout(() => setState({ key, items: cached }), 0)
      return () => clearTimeout(timer)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchSymbols(text, { prefer, signal: controller.signal })
        .then((items) => {
          const list = Array.isArray(items) ? items : []
          if (list.length > 0) cache.set(key, list)
          setState({ key, items: list })
        })
        .catch(() => {}) // suggestions are a nicety; typing the symbol by hand always works
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, text, prefer, debounceMs])

  return key && state.key === key ? state.items : []
}
