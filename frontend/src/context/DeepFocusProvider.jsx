import { useState } from 'react'
import { useFocusPreferences } from '../hooks/useFocusPreferences'
import { DeepFocusContext } from './deepFocusContext'

const DEEP_FOCUS_KEY = 'tradecommit.deepFocus.enabled.v1'

const readDeepFocus = () => {
  try {
    return window.localStorage.getItem(DEEP_FOCUS_KEY) === '1'
  } catch {
    return false
  }
}

export function DeepFocusProvider({ children }) {
  const [isEnabled, setEnabled] = useState(readDeepFocus)
  const [mainHeaderHost, setMainHeaderHost] = useState(null)
  const [plannerHeaderHost, setPlannerHeaderHost] = useState(null)
  const focusPreferences = useFocusPreferences()
  const setIsEnabled = (next) => {
    setEnabled((current) => {
      const enabled = typeof next === 'function' ? next(current) : next
      try {
        window.localStorage.setItem(DEEP_FOCUS_KEY, enabled ? '1' : '0')
      } catch {
        // The current page state still works when storage is unavailable.
      }
      return enabled
    })
  }
  return (
    <DeepFocusContext.Provider value={{ isEnabled, setIsEnabled, mainHeaderHost, setMainHeaderHost, plannerHeaderHost, setPlannerHeaderHost, ...focusPreferences }}>
      {children}
    </DeepFocusContext.Provider>
  )
}
