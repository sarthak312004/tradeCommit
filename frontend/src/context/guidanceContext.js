import { createContext } from 'react'

const noop = () => {}

// Outside a provider every request is a no-op: a guide that cannot be granted stays closed (fail safe).
export const GuidanceContext = createContext({
  activeId: null,
  activeTrigger: null,
  activeMeta: null,
  activeSeq: 0,
  pausedId: null,
  suspended: false,
  modalOpen: false,
  request: noop,
  release: noop,
  handoff: noop,
})
