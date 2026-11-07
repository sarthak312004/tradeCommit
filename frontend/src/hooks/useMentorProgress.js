import { useCallback, useEffect, useState } from 'react'
import { getMentorProgress, markMentorCelebrated } from '../services/progressApi'

/**
 * Progress towards the first AI mentor review. If the request fails, the orb keeps its previous progress state.
 */
export function useMentorProgress(savedTradeCount, override = null) {
  const [progress, setProgress] = useState(null)

  // fetch on mount and whenever the number of saved trades changes, including deletions
  useEffect(() => {
    if (override) return undefined
    let cancelled = false
    getMentorProgress()
      .then((next) => {
        if (!cancelled && next) setProgress(next)
      })
      .catch((error) => {
        console.error('Could not fetch mentor unlock progress:', error)
      })
    return () => { cancelled = true }
  }, [savedTradeCount, override])

  const celebrate = useCallback(async () => {
    if (override) return
    setProgress((current) => (current ? { ...current, celebrated: true } : current))
    try {
      await markMentorCelebrated()
    } catch (error) {
      console.error('Could not mark mentor unlock as celebrated:', error)
    }
  }, [override])

  return { progress: override ?? progress, celebrate }
}
