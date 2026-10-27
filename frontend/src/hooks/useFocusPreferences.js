import { useCallback, useEffect, useRef, useState } from 'react'
import { getProfile, saveFocusPreferences } from '../services/profileApi'

const DEFAULT_PREFERENCES = { spotifyUrl: '', focusTheme: 'sage' }
const FOCUS_THEMES = new Set(['sage', 'ocean', 'amber'])

const normalizePreferences = (saved) => ({
  spotifyUrl: typeof saved?.spotifyUrl === 'string' ? saved.spotifyUrl : '',
  focusTheme: FOCUS_THEMES.has(saved?.focusTheme) ? saved.focusTheme : 'sage',
})

export function useFocusPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const saveQueueRef = useRef(Promise.resolve())
  const preferencesRef = useRef(DEFAULT_PREFERENCES)
  const saveSequenceRef = useRef(0)

  const updatePreferences = useCallback((next) => {
    preferencesRef.current = next
    setPreferences(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    getProfile()
      .then((profile) => {
        if (cancelled) return
        updatePreferences(normalizePreferences(profile?.focusPreferences))
        setIsLoaded(true)
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error.message || 'Could not load focus preferences.')
      })

    const handleAuthChange = () => {
      updatePreferences(DEFAULT_PREFERENCES)
      setIsLoaded(false)
      setLoadError('')
      setLoadAttempt((attempt) => attempt + 1)
    }
    window.addEventListener('auth-state-changed', handleAuthChange)
    return () => {
      cancelled = true
      window.removeEventListener('auth-state-changed', handleAuthChange)
    }
  }, [loadAttempt, updatePreferences])

  const retryLoad = useCallback(() => {
    setIsLoaded(false)
    setLoadError('')
    setLoadAttempt((attempt) => attempt + 1)
  }, [])

  const savePreferences = useCallback((next) => {
    const normalized = normalizePreferences(next)
    const previous = preferencesRef.current
    const saveSequence = ++saveSequenceRef.current
    updatePreferences(normalized)
    setSaveError('')
    setIsSaving(true)

    const request = saveQueueRef.current.catch(() => undefined).then(() => saveFocusPreferences(normalized))
    saveQueueRef.current = request
    return request
      .then((saved) => {
        if (saveSequence === saveSequenceRef.current) updatePreferences(normalizePreferences(saved))
        return saved
      })
      .catch((error) => {
        if (saveSequence === saveSequenceRef.current) {
          updatePreferences(previous)
          setSaveError(error.message || 'Could not save focus preferences.')
        }
        return undefined
      })
      .finally(() => {
        if (saveSequence === saveSequenceRef.current) setIsSaving(false)
      })
  }, [updatePreferences])

  return { preferences, isLoaded, loadError, isSaving, saveError, savePreferences, retryLoad }
}
