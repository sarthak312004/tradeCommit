// Remembers, per account and per browser, which guided tours are still waiting to be shown.
//
//   queueProductTours()  - called once, when onboarding finishes: every tour becomes "pending"
//   getTourStatus()      - 'pending' | 'done' | null (null = never queued, e.g. an account that predates the tour)
//   replayProductTour()  - "Take the product tour" in the profile menu: starts the tour for the page you are on
//
// Only a fresh sign-up is ever queued, so nobody who already knows the app gets hints they did not ask for.

export const TOUR_REPLAY_EVENT = 'tradecommit:start-tour'
export const TOUR_STATUS_CHANGE_EVENT = 'tradecommit:tour-status-change'
export const TOUR_ACTIVITY_CHANGE_EVENT = 'tradecommit:tour-activity-change'

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
    window.dispatchEvent(new CustomEvent(TOUR_STATUS_CHANGE_EVENT, {
      detail: { username: String(username).toLowerCase(), tourId, status }
    }))
  } catch {
    // storage unavailable (private mode): the tour just won't be remembered
  }
}

const activeToursByUser = new Map()

export const isTourActive = (username) => Boolean(activeToursByUser.get(String(username).toLowerCase())?.size)

export const setTourActive = (username, tourId, isActive) => {
  const key = String(username).toLowerCase()
  const activeTours = activeToursByUser.get(key) ?? new Set()
  if (isActive) {
    activeTours.add(tourId)
    activeToursByUser.set(key, activeTours)
  } else {
    activeTours.delete(tourId)
    if (activeTours.size === 0) activeToursByUser.delete(key)
  }
  window.dispatchEvent(new CustomEvent(TOUR_ACTIVITY_CHANGE_EVENT, { detail: { username: key } }))
}

// Tour progress is stored under the username, so a rename in the Profile section must carry it over.
export const moveTourState = (fromUsername, toUsername) => {
  if (!fromUsername || !toUsername || String(fromUsername).toLowerCase() === String(toUsername).toLowerCase()) return
  try {
    ;['main', 'journal', 'planner'].forEach((tourId) => {
      const status = window.localStorage.getItem(storageKey(fromUsername, tourId))
      if (status === null) return
      window.localStorage.setItem(storageKey(toUsername, tourId), status)
      window.localStorage.removeItem(storageKey(fromUsername, tourId))
    })
  } catch {
    // storage unavailable: nothing was remembered anyway
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
