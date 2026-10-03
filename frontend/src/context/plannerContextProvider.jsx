import { useCallback, useEffect, useMemo, useState } from 'react'
import { plannerContext } from './Context'
import { plannerApi } from '../services/plannerApi'

/** Holds the list of planners (the sidebar section). Plans inside a planner load via usePlanEntries. */
function PlannerContextProvider({ children }) {
  const [planners, setPlanners] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let latestLoad = 0

    const loadPlanners = async () => {
      const loadId = ++latestLoad
      try {
        const authResponse = await fetch('/api/v1/auth/check', { credentials: 'include' })
        const rows = authResponse.ok ? await plannerApi.list() : []
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

  const createPlanner = useCallback(async (name, type) => {
    const created = await plannerApi.create({ name: name.trim(), type: type.trim() })
    setPlanners((current) => [...current, created])
    return created
  }, [])

  const updatePlanner = useCallback(async (id, name) => {
    const updated = await plannerApi.update(id, { name: name.trim() })
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
