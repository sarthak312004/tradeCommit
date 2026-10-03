import { useCallback, useEffect, useState } from 'react'
import { plannerApi } from '../services/plannerApi'

/** Loads and mutates the plans (calendar entries) of one planner. */
export function usePlanEntries(plannerId) {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    plannerApi
      .listEntries(plannerId)
      .then((rows) => !cancelled && setEntries(rows))
      .catch((loadError) => !cancelled && setError(loadError.message || 'Could not load plans'))
      .finally(() => !cancelled && setIsLoading(false))

    return () => {
      cancelled = true
    }
  }, [plannerId])

  const addEntry = useCallback(async (entry) => {
    const created = await plannerApi.createEntry(plannerId, entry)
    setEntries((current) => [...current, created])
    return created
  }, [plannerId])

  const updateEntry = useCallback(async (entryId, entry) => {
    const updated = await plannerApi.updateEntry(plannerId, entryId, entry)
    setEntries((current) => current.map((item) => (item.id === entryId ? updated : item)))
    return updated
  }, [plannerId])

  const removeEntry = useCallback(async (entryId) => {
    await plannerApi.removeEntry(plannerId, entryId)
    setEntries((current) => current.filter((item) => item.id !== entryId))
  }, [plannerId])

  const uploadImage = useCallback((file) => plannerApi.uploadImage(plannerId, file), [plannerId])

  return { entries, isLoading, error, addEntry, updateEntry, removeEntry, uploadImage }
}
