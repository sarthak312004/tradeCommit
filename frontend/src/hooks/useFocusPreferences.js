import { useCallback, useEffect, useRef, useState } from 'react'
import { getProfile, saveFocusPreferences } from '../services/profileApi'

const DEFAULT_PREFERENCES = { spotifyUrl: '', youtubeUrl: '', musicProvider: '', focusTheme: 'sage' }
const FOCUS_THEMES = new Set(['sage', 'ocean', 'amber'])

// One saved playlist per account: `musicProvider` says which of the two links is active (mirrors toMusicPreferences on the server).
const normalizeMusic = (saved) => {
  const spotifyUrl = typeof saved?.spotifyUrl === 'string' ? saved.spotifyUrl : ''
  const youtubeUrl = typeof saved?.youtubeUrl === 'string' ? saved.youtubeUrl : ''
  let musicProvider = saved?.musicProvider === 'spotify' || saved?.musicProvider === 'youtube' ? saved.musicProvider : ''
  if (musicProvider === 'spotify' && !spotifyUrl) musicProvider = ''
  if (musicProvider === 'youtube' && !youtubeUrl) musicProvider = ''
  if (!musicProvider && spotifyUrl) musicProvider = 'spotify'
  return { musicProvider, spotifyUrl: musicProvider === 'youtube' ? '' : spotifyUrl, youtubeUrl: musicProvider === 'youtube' ? youtubeUrl : '' }
}

const normalizePreferences = (saved) => ({
  ...normalizeMusic(saved),
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
