import { useContext } from 'react'
import { DeepFocusContext } from './deepFocusContext'

export function useDeepFocus() {
  const context = useContext(DeepFocusContext)
  if (!context) throw new Error('useDeepFocus must be used within DeepFocusProvider')
  return context
}
