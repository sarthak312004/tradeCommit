import { createContext, useContext } from 'react'
import { planDefaults } from './demoData'

// In-memory state for the sandbox scenes. It lives in React state inside the dialog and is discarded when the dialog closes.
// Nothing here touches localStorage, the network or any account data.

export const SandboxContext = createContext(null)

export const initialSandboxState = () => ({
  setupId: 'pullback',
  ruleChecks: {},
  plan: planDefaults('pullback'),
  planTouched: false,
  adopted: [], // finding ids the user chose to turn into strategy rules
})

export function sandboxReducer(state, action) {
  switch (action.type) {
    case 'pick-setup':
      return { ...state, setupId: action.id, plan: state.planTouched ? state.plan : planDefaults(action.id) }
    case 'toggle-rule':
      return { ...state, ruleChecks: { ...state.ruleChecks, [action.id]: !state.ruleChecks[action.id] } }
    case 'edit-plan':
      return { ...state, planTouched: true, plan: { ...state.plan, [action.field]: action.value } }
    case 'reset-plan':
      return { ...state, planTouched: false, plan: planDefaults(state.setupId) }
    case 'toggle-adopt':
      return { ...state, adopted: state.adopted.includes(action.id) ? state.adopted.filter((id) => id !== action.id) : [...state.adopted, action.id] }
    default:
      return state
  }
}

export function useSandbox() {
  const value = useContext(SandboxContext)
  if (!value) throw new Error('useSandbox must be used inside <SandboxProvider>')
  return value
}
