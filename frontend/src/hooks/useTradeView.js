import { useCallback, useState } from 'react'

// How the Trades tab lays trades out: 'table' (default) or 'cards'. Remembered in this browser, for every journal.
const KEY = 'tradecommit:trade-view'
export const TRADE_VIEWS = ['table', 'cards']
export const DEFAULT_TRADE_VIEW = 'table'

const read = () => {
  try {
    const saved = window.localStorage.getItem(KEY)
    if (TRADE_VIEWS.includes(saved)) return saved
  } catch {
    // storage unavailable: fall back to the default
  }
  return DEFAULT_TRADE_VIEW
}

export function useTradeView() {
  const [layout, setLayout] = useState(read)

  const update = useCallback((next) => {
    if (!TRADE_VIEWS.includes(next)) return
    setLayout(next)
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      // private mode: the choice just isn't remembered
    }
  }, [])

  return [layout, update]
}
