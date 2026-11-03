// Quick Log: keeps the trade form open after a NEW trade is saved. The preference lives in this browser only
// (no API field, no profile setting).

export const QUICK_LOG_KEY = 'tradecommit:quick-log'

const defaultStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // storage blocked
  }
}

// OFF unless the person switched it on
export const readQuickLog = (storage = defaultStorage()) => {
  try {
    return storage?.getItem(QUICK_LOG_KEY) === '1'
  } catch {
    return false
  }
}

export const writeQuickLog = (enabled, storage = defaultStorage()) => {
  try {
    if (enabled) storage?.setItem(QUICK_LOG_KEY, '1')
    else storage?.removeItem(QUICK_LOG_KEY)
  } catch {
    // storage blocked or full: the switch still works for this session
  }
}

// Only a NEW trade can keep the form open; saving an edit always closes it.
export const shouldKeepFormOpen = ({ quickLog, isEditing }) => Boolean(quickLog) && !isEditing

// "Trade saved successfully" (+ the symbol when there is one)
export const savedToastText = (symbol) => {
  const clean = String(symbol ?? '').trim().toUpperCase()
  return { message: 'Trade saved successfully', detail: clean }
}
