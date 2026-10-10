// Remembers, per account and per browser, which guided tours are still waiting to be shown.
//
//   queueProductTours()  - called once, when onboarding finishes: every tour becomes "pending"
//   getTourStatus()      - 'pending' | 'done' | null (null = never queued, e.g. an account that predates the tour)
//   replayProductTour()  - "Take the product tour" in the profile menu: starts the tour for the page you are on
//
// Only a fresh sign-up is ever queued, so nobody who already knows the app gets hints they did not ask for.

export const TOUR_REPLAY_EVENT = 'tradecommit:start-tour'

const storageKey = (username, tourId) => `tradecommit:tour:${String(username).toLowerCase()}:${tourId}`

export const getTourStatus = (username, tourId) => {
  try {
    return window.localStorage.getItem(storageKey(username, tourId))
  } catch {
    return null
  }
}

export const setTourStatus = (username, tourId, status) => {
  try {
    window.localStorage.setItem(storageKey(username, tourId), status)
  } catch {
    // storage unavailable (private mode): the tour just won't be remembered
  }
}

export const queueProductTours = (username) => {
  if (!username) return
  setTourStatus(username, 'main', 'pending')
  setTourStatus(username, 'journal', 'pending')
  setTourStatus(username, 'planner', 'pending')
}

// A tour that ended must never start again by itself in this tab, even if the browser refused to store 'done'.
const endedThisSession = new Set()
export const markTourEnded = (username, tourId) => endedThisSession.add(`${username}:${tourId}`)
export const hasTourEnded = (username, tourId) => endedThisSession.has(`${username}:${tourId}`)

export const replayProductTour = () => window.dispatchEvent(new Event(TOUR_REPLAY_EVENT))
