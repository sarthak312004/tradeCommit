// The rules of the ONE guidance controller (pure: no React, no storage, no DOM, so it is unit-tested with `node --test`).
//
// The spotlight tours and mission-completion dialog share one controller so they never overlap each other or a form.
//
// Rules this reducer enforces:
//   1. Exactly one guide is `active`. A request made while one is active is ignored (never interrupts, never queues).
//   2. Requests made while nothing is active wait a few ms in `pending`; `resolve` then starts exactly ONE of them
//      (explicit user requests first, then by priority). The rest are dropped: guides never chain back-to-back.
//   3. After a guide ends, AUTOMATIC requests are ignored on that same route (`settledRoute`) until the user navigates.
//   4. While a real application modal/form is open (`modalOpen`), nothing starts; an active guide is `suspended`
//      (hidden, state kept) and returns when the form closes.

export const GUIDES = Object.freeze({
  TOUR_MAIN: 'tour:main',
  TOUR_JOURNAL: 'tour:journal',
  TOUR_PLANNER: 'tour:planner',
})

export const GUIDE_PRIORITY = Object.freeze({
  [GUIDES.TOUR_MAIN]: 50,
  [GUIDES.TOUR_JOURNAL]: 30,
  [GUIDES.TOUR_PLANNER]: 20,
})

export const tourGuideId = (tourId) => `tour:${tourId}`
export const tourIdOf = (guideId) => (typeof guideId === 'string' && guideId.startsWith('tour:') ? guideId.slice(5) : null)

export const initialGuidanceState = Object.freeze({
  active: null, // { id, trigger: 'auto' | 'user', meta, seq, route }
  pending: [], // requests waiting for `resolve` (only ever filled while nothing is active)
  modalOpen: false, // a real (non-guide) modal or form is on screen
  settledRoute: null, // route on which a guide just ended: automatic guides wait until the user navigates
  seq: 0,
})

export const isSuspended = (state) => Boolean(state.active) && state.modalOpen

const rank = (a, b) => {
  if (a.trigger !== b.trigger) return a.trigger === 'user' ? -1 : 1
  return (GUIDE_PRIORITY[b.id] ?? 0) - (GUIDE_PRIORITY[a.id] ?? 0)
}

export function guidanceReducer(state, action) {
  switch (action.type) {
    case 'request': {
      const { id, route = null, meta = null } = action
      const trigger = action.trigger === 'user' ? 'user' : 'auto'
      if (!(id in GUIDE_PRIORITY)) return state
      if (state.active) return state // busy: never interrupt, never queue, duplicates included
      if (trigger === 'auto' && route !== null && state.settledRoute === route) return state
      if (trigger === 'user' && state.modalOpen) return state // a real form is open: do not open on top of it
      const existing = state.pending.find((item) => item.id === id)
      if (existing) {
        if (trigger === 'user' && existing.trigger === 'auto') {
          return { ...state, pending: state.pending.map((item) => (item.id === id ? { id, trigger, meta, route } : item)) }
        }
        return state // duplicate request
      }
      return { ...state, pending: [...state.pending, { id, trigger, meta, route }] }
    }

    case 'resolve': {
      if (state.active || state.modalOpen || state.pending.length === 0) return state
      const [winner] = [...state.pending].sort(rank)
      return {
        ...state,
        active: { id: winner.id, trigger: winner.trigger, meta: winner.meta, route: winner.route, seq: state.seq + 1 },
        pending: [], // everything else is dropped on purpose: no back-to-back guides
        seq: state.seq + 1,
      }
    }

    case 'release': {
      const { id, route = null } = action
      if (state.active?.id !== id) {
        const pending = state.pending.filter((item) => item.id !== id)
        return pending.length === state.pending.length ? state : { ...state, pending }
      }
      return { ...state, active: null, pending: state.pending.filter((item) => item.trigger === 'user'), settledRoute: route }
    }

    case 'modal': {
      const open = Boolean(action.open)
      return open === state.modalOpen ? state : { ...state, modalOpen: open }
    }

    case 'navigate':
      return state.settledRoute !== null && state.settledRoute !== action.route ? { ...state, settledRoute: null } : state

    default:
      return state
  }
}
