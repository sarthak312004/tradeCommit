import { useCallback, useState } from 'react'
import { DEFAULT_CARD_FIELDS, limitCardFields } from '../utils/tradeCardFields'

// Which details (max 3) the trade chips show when hovered. Remembered in this browser, for every journal.
const KEY = 'tradecommit:trade-card-fields'

const read = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY))
    if (Array.isArray(saved)) return limitCardFields(saved) // older saves may hold more than the limit
  } catch {
    // unreadable or storage unavailable: fall back to the defaults
  }
  return DEFAULT_CARD_FIELDS
}

export function useTradeCardFields() {
  const [fields, setFields] = useState(read)

  const update = useCallback((next) => {
    const limited = limitCardFields(next)
    setFields(limited)
    try {
      window.localStorage.setItem(KEY, JSON.stringify(limited))
    } catch {
      // storage unavailable (private mode): the choice just isn't remembered
    }
  }, [])

  return [fields, update]
}
