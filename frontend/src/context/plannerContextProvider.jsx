import { useCallback, useEffect, useMemo, useState } from 'react'
import { plannerContext } from './Context'
import { plannerApi, normalizePlanner } from '../services/plannerApi'
import { readJson } from '../utils/http'
import { fetchPrefetched } from '../utils/prefetch'

/** Holds the list of planners (the sidebar section). Plans inside a planner load via usePlanEntries. */
function PlannerContextProvider({ children }) {
  const [planners, setPlanners] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let latestLoad = 0

    const loadPlanners = async () => {
      const loadId = ++latestLoad
      try {
        // No separate auth pre-flight: a 401 just means "logged out". On first load this reuses the
        // request index.html started before the bundle arrived.
        const response = await fetchPrefetched('planners', '/api/v1/planners')
        const rows = response.status === 401 ? [] : ((await readJson(response)) ?? []).map(normalizePlanner)
        if (loadId === latestLoad) setPlanners(rows)
      } catch {
        if (loadId === latestLoad) setPlanners([])
      } finally {
        if (loadId === latestLoad) setIsLoading(false)
      }
    }

    window.addEventListener('auth-state-changed', loadPlanners)
    loadPlanners()

    return () => {
      latestLoad += 1
      window.removeEventListener('auth-state-changed', loadPlanners)
    }
  }, [])

  const createPlanner = useCallback(async (name, type, linkedJournalId = null) => {
    const created = await plannerApi.create({ name: name.trim(), type: type.trim(), linkedJournalId })
    setPlanners((current) => [...current, created])
    return created
  }, [])

  // `changes` is a new name (string) or an object like { name } / { linkedJournalId } (null disconnects the journal)
  const updatePlanner = useCallback(async (id, changes) => {
    const body = typeof changes === 'string' ? { name: changes.trim() } : changes
    const updated = await plannerApi.update(id, body)
    setPlanners((current) => current.map((planner) => (planner.id === id ? updated : planner)))
    return updated
  }, [])

  const deletePlanner = useCallback(async (id) => {
    await plannerApi.remove(id)
    setPlanners((current) => current.filter((planner) => planner.id !== id))
  }, [])

  const value = useMemo(
    () => ({ planners, isLoading, createPlanner, updatePlanner, deletePlanner }),
    [planners, isLoading, createPlanner, updatePlanner, deletePlanner]
  )

  return <plannerContext.Provider value={value}>{children}</plannerContext.Provider>
}

export { PlannerContextProvider }
