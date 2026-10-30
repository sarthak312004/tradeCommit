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

  const addEntry = useCallback(async (entry, prepare = async () => entry) => {
    const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setError('')
    setEntries((current) => [...current, { ...entry, id: pendingId, syncState: 'saving' }])
    try {
      const ready = await prepare()
      const created = await plannerApi.createEntry(plannerId, { ...entry, ...ready })
      setEntries((current) => current.map((item) => (item.id === pendingId ? created : item)))
      return created
    } catch (saveError) {
      setEntries((current) => current.filter((item) => item.id !== pendingId))
      setError(saveError.message || 'Could not save plan')
      throw saveError
    }
  }, [plannerId])

  const updateEntry = useCallback(async (entryId, entry, prepare = async () => entry) => {
    const previous = entries.find((item) => item.id === entryId)
    setError('')
    setEntries((current) => current.map((item) => (item.id === entryId ? { ...item, ...entry, syncState: 'saving' } : item)))
    try {
      const ready = await prepare()
      const updated = await plannerApi.updateEntry(plannerId, entryId, { ...entry, ...ready })
      setEntries((current) => current.map((item) => (item.id === entryId ? updated : item)))
      return updated
    } catch (saveError) {
      if (previous) setEntries((current) => current.map((item) => (item.id === entryId ? previous : item)))
      setError(saveError.message || 'Could not save plan')
      throw saveError
    }
  }, [entries, plannerId])

  const removeEntry = useCallback(async (entryId) => {
    await plannerApi.removeEntry(plannerId, entryId)
    setEntries((current) => current.filter((item) => item.id !== entryId))
  }, [plannerId])

  const uploadImage = useCallback((file) => plannerApi.uploadImage(plannerId, file), [plannerId])

  return { entries, isLoading, error, addEntry, updateEntry, removeEntry, uploadImage }
}
