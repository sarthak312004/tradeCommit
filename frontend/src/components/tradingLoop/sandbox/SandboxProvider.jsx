import { useMemo, useReducer } from 'react'
import { SandboxContext, initialSandboxState, sandboxReducer } from './sandboxState'

/** Holds the sandbox's demo state for one open dialog. Closing the dialog discards it. */
export default function SandboxProvider({ children }) {
  const [state, dispatch] = useReducer(sandboxReducer, undefined, initialSandboxState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>
}
