import { useCallback, useSyncExternalStore } from 'react'

// Whether trade chips hide their result (P&L). One shared choice for every chip, remembered in this browser.
const KEY = 'tradecommit:hide-pnl'

const listeners = new Set()

const read = () => {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false // storage unavailable: show the result
  }
}

let hidden = read()

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => hidden

const setHidden = (next) => {
  if (next === hidden) return
  hidden = next
  try {
    window.localStorage.setItem(KEY, next ? '1' : '0')
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
  listeners.forEach((listener) => listener())
}

// keep other tabs in step
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    hidden = read()
    listeners.forEach((listener) => listener())
  })
}

export function useHidePnl() {
  const isHidden = useSyncExternalStore(subscribe, getSnapshot, () => false)
  const toggle = useCallback(() => setHidden(!hidden), [])
  return [isHidden, toggle]
}
