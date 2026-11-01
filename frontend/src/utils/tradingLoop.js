// State + rollout switch for "TradeCommit: The Trading Loop" (the new first-run experience).
//
//   isTradingLoopEnabled()          - the rollout switch (see below). OFF = production behaves exactly as before.
//   queueTradingLoopOnboarding()    - called once, when a brand-new account finishes onboarding
//   getLoopStatus() / setLoopStatus - 'pending' | 'snoozed' | 'done' | null (null = never queued, e.g. every existing account)
//   get/set/clearLoopProgress       - the scene the user was on, so a refresh resumes instead of restarting
//   openTradingLoop()               - replay from anywhere (profile menu); never touches the stored status
//
// Only a fresh sign-up is ever queued, so existing accounts never receive it by themselves.
// Storage keys use their own prefix (`tradecommit:loop:*`) and never touch the old `tradecommit:tour:*` keys,
// except that, while the switch is on, the loop stands in for the old *welcome* tour (see queueTradingLoopOnboarding).

import { getTourStatus, setTourStatus } from './productTour'

export const OPEN_TRADING_LOOP_EVENT = 'tradecommit:open-trading-loop'
export const TRADING_LOOP_STATUS_EVENT = 'tradecommit:trading-loop-status'

const FLAG_OVERRIDE_KEY = 'tradecommit:flag:trading-loop'

/**
 * Rollout switch.
 *   build-time: VITE_TRADING_LOOP_ONBOARDING=true   (unset / anything else = off)
 *   per-browser override for QA: localStorage['tradecommit:flag:trading-loop'] = 'on' | 'off'
 */
export const isTradingLoopEnabled = () => {
  try {
    const override = window.localStorage.getItem(FLAG_OVERRIDE_KEY)
    if (override === 'on') return true
    if (override === 'off') return false
  } catch {
    // storage unavailable: fall through to the build-time value
  }
  return import.meta.env.VITE_TRADING_LOOP_ONBOARDING === 'true'
}

const keyOf = (username) => String(username).toLowerCase()
const statusKey = (username) => `tradecommit:loop:${keyOf(username)}`
const progressKey = (username) => `tradecommit:loop-step:${keyOf(username)}`

export const getLoopStatus = (username) => {
  if (!username) return null
  try {
    return window.localStorage.getItem(statusKey(username))
  } catch {
    return null
  }
}

export const setLoopStatus = (username, status) => {
  if (!username) return
  try {
    window.localStorage.setItem(statusKey(username), status)
  } catch {
    // storage unavailable (private mode): the choice just is not remembered
  }
  window.dispatchEvent(new CustomEvent(TRADING_LOOP_STATUS_EVENT, { detail: { username: keyOf(username), status } }))
}

export const getLoopProgress = (username) => {
  if (!username) return null
  try {
    return window.localStorage.getItem(progressKey(username))
  } catch {
    return null
  }
}

export const setLoopProgress = (username, sceneId) => {
  if (!username) return
  try {
    window.localStorage.setItem(progressKey(username), sceneId)
  } catch {
    // storage unavailable: resume starts from the first scene
  }
}

export const clearLoopProgress = (username) => {
  if (!username) return
  try {
    window.localStorage.removeItem(progressKey(username))
  } catch {
    // nothing was stored
  }
}

// Subscribe/snapshot pair for useSyncExternalStore.
export const subscribeLoopStatus = (callback) => {
  window.addEventListener(TRADING_LOOP_STATUS_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(TRADING_LOOP_STATUS_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/**
 * New account, rollout switch ON: the loop replaces the whole automatic tour sequence (welcome, journal AND planner), so a
 * new user is never walked through several guides one after another. The journal and planner tours are NOT queued; they
 * stay available as manual, contextual help ("Take the product tour"). A status that already exists is never overwritten;
 * an unset one is recorded as 'done' so nothing queues it later (and the journal "import" hint keeps its old trigger).
 */
export const queueTradingLoopOnboarding = (username) => {
  if (!username) return
  setLoopStatus(username, 'pending')
  setTourStatus(username, 'main', 'done')
  ;['journal', 'planner'].forEach((tourId) => {
    if (getTourStatus(username, tourId) === null) setTourStatus(username, tourId, 'done')
  })
}

// `{ resume: true }` (the MissionTracker click): continue the onboarding loop where it stopped if it is pending or snoozed;
// without it (profile menu) the loop is always replayed from the start and never changes the stored status.
export const openTradingLoop = (detail) => window.dispatchEvent(new CustomEvent(OPEN_TRADING_LOOP_EVENT, { detail: detail ?? null }))
