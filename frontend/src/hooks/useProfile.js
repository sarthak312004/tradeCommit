import { useCallback, useEffect, useState } from 'react'
import { PROFILE_UPDATED_EVENT, clearProfileCache, getProfile } from '../services/profileApi'

/** Loads the signed-in user's profile (fullname, username, email, hasPassword). */
export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getProfile()
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        setError('')
      })
      .catch((loadError) => !cancelled && setError(loadError.message || 'Could not load your profile'))
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // a different account logging in on this tab must not see the previous profile
  useEffect(() => {
    const handleAuthChange = () => {
      clearProfileCache()
      setProfile(null)
      setReloadKey((key) => key + 1)
    }
    window.addEventListener('auth-state-changed', handleAuthChange)
    return () => window.removeEventListener('auth-state-changed', handleAuthChange)
  }, [])

  // the name or username was edited in the profile card: show the saved values everywhere at once
  useEffect(() => {
    const handleProfileUpdated = () => {
      getProfile().then(setProfile).catch(() => {})
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated)
  }, [])

  const retry = useCallback(() => {
    clearProfileCache()
    setError('')
    setReloadKey((key) => key + 1)
  }, [])

  return { profile, error, retry }
}
