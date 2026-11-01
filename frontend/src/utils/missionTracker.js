// State, rollout switch, analytics and hand-off helpers for the Trading Loop mission tracker (guided activation).
//
// Everything is per account and per browser (localStorage, keys `tradecommit:mission:*`). There is NO backend or schema change:
// the tracker only reads state the app already has (journals, planners, trades, mentor progress) and uses the app's own
// create / link / log / review flows for every real action.
//
//   isMissionTrackerEnabled()        rollout switch, default OFF
//   queueMission(username)           a brand-new account (finished onboarding while the switch is on) gets the tracker
//   openMission()                    opt-in for anyone else (profile menu); never happens by itself for existing accounts
//   get/set MissionStatus            'active' | 'minimized' | 'dismissed' | 'complete' | null (null = never offered)
//   requestMissionAction()           ask the journal page to open the real "new trade" form or the AI mentor
//   trackMissionEvent()              Vercel Analytics custom event, at most once per account per event

import { track } from '@vercel/analytics'

export const MISSION_CHANGE_EVENT = 'tradecommit:mission-change'
export const OPEN_MISSION_EVENT = 'tradecommit:open-mission'
export const MISSION_ACTION_EVENT = 'tradecommit:mission-action'
export const MENTOR_OPENED_EVENT = 'tradecommit:mentor-opened'

const FLAG_OVERRIDE_KEY = 'tradecommit:flag:mission-tracker'

/**
 * Rollout switch.
 *   build-time: VITE_MISSION_TRACKER=true   (unset / anything else = off)
 *   per-browser QA override: localStorage['tradecommit:flag:mission-tracker'] = 'on' | 'off'
 */
export const isMissionTrackerEnabled = () => {
  try {
    const override = window.localStorage.getItem(FLAG_OVERRIDE_KEY)
    if (override === 'on') return true
    if (override === 'off') return false
  } catch {
    // storage unavailable: fall back to the build-time value
  }
  return import.meta.env.VITE_MISSION_TRACKER === 'true'
}

const who = (username) => String(username).toLowerCase()
const key = (part, username) => `tradecommit:mission${part}:${who(username)}`

const read = (name, username) => {
  if (!username) return null
  try {
    return window.localStorage.getItem(key(name, username))
  } catch {
    return null
  }
}

const write = (name, username, value) => {
  if (!username) return
  try {
    if (value === null) window.localStorage.removeItem(key(name, username))
    else window.localStorage.setItem(key(name, username), value)
  } catch {
    // storage unavailable (private mode): the choice just is not remembered
  }
  window.dispatchEvent(new Event(MISSION_CHANGE_EVENT))
}

export const getMissionStatus = (username) => read('', username)
export const setMissionStatus = (username, status) => write('', username, status)

export const getMissionTarget = (username) => read('-target', username)
export const setMissionTarget = (username, journalId) => write('-target', username, journalId || null)

const parseList = (raw) => {
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
// snapshot as a string so useSyncExternalStore sees a stable value
export const getMissionSkippedRaw = (username) => read('-skipped', username) ?? '[]'
export const getMissionSkipped = (username) => parseList(getMissionSkippedRaw(username))
export const skipMissionStep = (username, stepId) => {
  const next = [...new Set([...getMissionSkipped(username), stepId])]
  write('-skipped', username, JSON.stringify(next))
}
export const unskipMissionStep = (username, stepId) => write('-skipped', username, JSON.stringify(getMissionSkipped(username).filter((id) => id !== stepId)))

// "the user has opened the AI mentor after it unlocked" (a saved review is detected separately, from the server)
export const getMentorSeen = (username) => read('-mentor-seen', username) === '1'
export const setMentorSeen = (username) => write('-mentor-seen', username, '1')

export const getMissionReachedRaw = (username) => read('-reached', username) ?? '[]'
export const markMissionReached = (username, stepIds) => {
  if (!username || !stepIds?.length) return
  const current = parseList(getMissionReachedRaw(username))
  const next = [...new Set([...current, ...stepIds])]
  if (next.length !== current.length) write('-reached', username, JSON.stringify(next))
}

const FINISHED_FLAG = '-finished'
export const finishMission = (username) => {
  write(FINISHED_FLAG, username, '1')
  setMissionStatus(username, 'dismissed')
}

export const isMissionClosed = (username) => !username || read(FINISHED_FLAG, username) === '1' || getMissionStatus(username) === 'dismissed'
export const isMissionFinished = (username) => isMissionClosed(username) || getMissionStatus(username) === 'complete'

export const subscribeMission = (callback) => {
  window.addEventListener(MISSION_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(MISSION_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

/** Fresh account + switch on: offer the mission. Never overwrites a choice the account already made. */
export const queueMission = (username) => {
  if (!username || !isMissionTrackerEnabled() || getMissionStatus(username)) return
  setMissionStatus(username, 'active')
}

/** Profile menu: anyone can opt in. Reopens a dismissed or completed tracker; progress is always recomputed from real data. */
export const openMission = () => window.dispatchEvent(new Event(OPEN_MISSION_EVENT))

// ---- hand-off to the journal page (the real forms live there) ----
// The page may not be mounted yet (we navigate first), so the request is also kept briefly and consumed on mount.
let pendingAction = null
const PENDING_TTL_MS = 8000

export const requestMissionAction = (action, journalId) => {
  pendingAction = { action, journalId, at: Date.now() }
  window.dispatchEvent(new Event(MISSION_ACTION_EVENT))
}

/** Returns and clears the pending request when it is fresh and meant for this journal; otherwise null. */
export const consumeMissionAction = (journalId) => {
  if (!pendingAction) return null
  const { action, journalId: wanted, at } = pendingAction
  if (Date.now() - at > PENDING_TTL_MS) {
    pendingAction = null
    return null
  }
  if (wanted && wanted !== journalId) return null
  pendingAction = null
  return action
}

export const announceMentorOpened = () => window.dispatchEvent(new Event(MENTOR_OPENED_EVENT))

// ---- analytics: reuse Vercel Analytics custom events; each fires once per account ----
export const MISSION_EVENTS = {
  started: 'trading_loop_started',
  completed: 'trading_loop_completed',
  plannerCreated: 'planner_created',
  plannerLinked: 'planner_linked',
  firstTrade: 'first_trade_logged',
  firstFeedback: 'first_ai_feedback_viewed',
}

export const trackMissionEvent = (username, name) => {
  if (!username) return
  const fired = parseList(read('-events', username))
  if (fired.includes(name)) return
  write('-events', username, JSON.stringify([...fired, name]))
  try {
    track(name) // no user data in the payload
  } catch {
    // analytics must never affect the app
  }
}
