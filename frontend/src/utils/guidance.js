// The rules of the ONE guidance controller (pure: no React, no storage, no DOM, so it is unit-tested with `node --test`).
//
// A "guide" is anything that takes over the user's attention to teach: The Trading Loop, the Trading Playbook and the
// legacy spotlight tours. The MissionTracker is NOT a guide: it is a small progress indicator that can ask for the loop.
//
// Rules this reducer enforces:
//   1. Exactly one guide is `active`. A request made while one is active is ignored (never interrupts, never queues).
//   2. Requests made while nothing is active wait a few ms in `pending`; `resolve` then starts exactly ONE of them
//      (explicit user requests first, then by priority). The rest are dropped: guides never chain back-to-back.
//   3. After a guide ends, AUTOMATIC requests are ignored on that same route (`settledRoute`) until the user navigates.
//   4. While a real application modal/form is open (`modalOpen`), nothing starts; an active guide is `suspended`
//      (hidden, state kept) and returns when the form closes.
//   5. The only guide-to-guide move is a user-initiated handoff Loop -> Playbook: the loop is `paused` and resumes
//      where it was when the playbook closes. Playbook never opens by itself.
//   6. With the Trading Loop switched ON the legacy tours (main/journal/planner) never start by themselves
//      (the loop replaces them; they stay available as manual help). With it OFF the loop cannot start at all.

export const GUIDES = Object.freeze({
  LOOP: 'trading-loop',
  LOOP_PREVIEW: 'trading-loop-preview', // the /trading-loop route: a user-opened preview that touches no stored state
  PLAYBOOK: 'playbook',
  MISSION_COMPLETE: 'mission-complete',
  TOUR_MAIN: 'tour:main',
  TOUR_JOURNAL: 'tour:journal',
  TOUR_PLANNER: 'tour:planner',
})

export const GUIDE_PRIORITY = Object.freeze({
  [GUIDES.LOOP]: 100,
  [GUIDES.LOOP_PREVIEW]: 100,
  [GUIDES.TOUR_MAIN]: 50,
  [GUIDES.TOUR_JOURNAL]: 30,
  [GUIDES.TOUR_PLANNER]: 20,
  [GUIDES.PLAYBOOK]: 10,
  [GUIDES.MISSION_COMPLETE]: 90,
})

const COOLDOWN_EXEMPT = new Set([GUIDES.MISSION_COMPLETE])

export const tourGuideId = (tourId) => `tour:${tourId}`
export const tourIdOf = (guideId) => (typeof guideId === 'string' && guideId.startsWith('tour:') ? guideId.slice(5) : null)

const HANDOFFS = new Set([`${GUIDES.LOOP}>${GUIDES.PLAYBOOK}`])

// Guides that may never start by themselves.
export const isAutoSuppressed = (id, loopEnabled) => id === GUIDES.PLAYBOOK || id === GUIDES.LOOP_PREVIEW || (loopEnabled && tourIdOf(id) !== null)

export const initialGuidanceState = Object.freeze({
  active: null, // { id, trigger: 'auto' | 'user', meta, seq, route }
  paused: null, // the guide a handoff put aside; resumes when the active one is released
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
      const { id, route = null, loopEnabled = false, meta = null } = action
      const trigger = action.trigger === 'user' ? 'user' : 'auto'
      if (!(id in GUIDE_PRIORITY)) return state
      if (id === GUIDES.LOOP && !loopEnabled) return state // switch off: the loop cannot start, not even manually
      if (state.active || state.paused) return state // busy: never interrupt, never queue, duplicates included
      if (trigger === 'auto' && (isAutoSuppressed(id, loopEnabled) || (route !== null && state.settledRoute === route && !COOLDOWN_EXEMPT.has(id)))) return state
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
      if (state.paused?.id === id && state.active?.id !== id) return { ...state, paused: null }
      if (state.active?.id !== id) {
        const pending = state.pending.filter((item) => item.id !== id)
        return pending.length === state.pending.length ? state : { ...state, pending }
      }
      if (state.paused) return { ...state, active: state.paused, paused: null } // resume the guide that was put aside
      return { ...state, active: null, pending: state.pending.filter((item) => item.trigger === 'user'), settledRoute: route }
    }

    case 'handoff': {
      const { from, to, fromMeta = null } = action
      if (state.active?.id !== from || state.paused || !HANDOFFS.has(`${from}>${to}`)) return state
      return {
        ...state,
        paused: { ...state.active, meta: { ...state.active.meta, ...fromMeta } },
        active: { id: to, trigger: 'user', meta: null, route: state.active.route, seq: state.seq + 1 },
        seq: state.seq + 1,
      }
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
