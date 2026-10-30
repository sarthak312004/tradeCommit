// Pure state machine for the Deep Planning Mode focus timer, separate from React.
//
// The timer never counts ticks. A running session stores the wall-clock moment it ends (`endAt`), and the
// remaining time is always `endAt - now`, so throttled background tabs, slow renders and page refreshes can't
// make it drift. A paused session stores the frozen `remainingMs` instead.
//
// Everything here is pure (the caller passes `now`) so it can be unit-tested without a browser.

export const STORAGE_KEY = 'tradecommit.focusTimer.v1'
export const PRESET_MINUTES = [15, 25, 45, 60, 90]
export const DEFAULT_MINUTES = 25
export const MIN_MINUTES = 1
export const MAX_MINUTES = 480

const MINUTE_MS = 60_000
const STATUSES = new Set(['idle', 'running', 'paused', 'completed'])

/** Whole minutes between MIN_MINUTES and MAX_MINUTES, or null when the input isn't a valid duration. */
export function parseMinutes(value) {
  const text = typeof value === 'number' ? String(value) : value
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!/^\d{1,4}$/.test(trimmed)) return null
  const minutes = Number(trimmed)
  return minutes >= MIN_MINUTES && minutes <= MAX_MINUTES ? minutes : null
}

export function createState(selectedMinutes = DEFAULT_MINUTES) {
  const minutes = parseMinutes(selectedMinutes) ?? DEFAULT_MINUTES
  return {
    status: 'idle',
    selectedMinutes: minutes,
    durationMs: minutes * MINUTE_MS,
    endAt: null,
    remainingMs: minutes * MINUTE_MS,
    completedAt: null
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function getRemainingMs(state, now) {
  switch (state.status) {
    case 'running': return clamp(state.endAt - now, 0, state.durationMs)
    case 'paused': return clamp(state.remainingMs, 0, state.durationMs)
    case 'completed': return 0
    default: return state.durationMs
  }
}

/** 0 -> 1 across the session; 1 once complete, 0 while idle. */
export function getProgress(state, now) {
  if (state.status === 'completed') return 1
  if (state.status === 'idle' || state.durationMs <= 0) return 0
  return clamp(1 - getRemainingMs(state, now) / state.durationMs, 0, 1)
}

/** Moves a running session whose end time has passed to `completed`. Returns the same object when nothing changed. */
export function settle(state, now) {
  if (state.status !== 'running' || state.endAt > now) return state
  return { ...state, status: 'completed', endAt: null, remainingMs: 0, completedAt: state.endAt }
}

/** Choose the duration for the next session. Only allowed while idle so a live session can't be clobbered. */
export function selectMinutes(state, minutes) {
  const parsed = parseMinutes(minutes)
  if (parsed === null || state.status !== 'idle') return state
  return createState(parsed)
}

/** Starts a session. Ignored while one is already running or paused, so there is only ever one timer. */
export function start(state, minutes, now) {
  if (state.status === 'running' || state.status === 'paused') return state
  const parsed = parseMinutes(minutes ?? state.selectedMinutes)
  if (parsed === null) return state
  const durationMs = parsed * MINUTE_MS
  return { status: 'running', selectedMinutes: parsed, durationMs, endAt: now + durationMs, remainingMs: durationMs, completedAt: null }
}

export function pause(state, now) {
  const current = settle(state, now)
  if (current.status !== 'running') return current
  return { ...current, status: 'paused', endAt: null, remainingMs: getRemainingMs(current, now) }
}

export function resume(state, now) {
  if (state.status !== 'paused') return state
  return { ...state, status: 'running', endAt: now + state.remainingMs }
}

/** Back to idle, keeping the last chosen duration. Also dismisses a completed session. */
export function reset(state) {
  return createState(state.selectedMinutes)
}

/** `mm:ss`, or `h:mm:ss` from one hour up. Rounds up so the clock reads 00:01 until the very end. */
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function serialize(state) {
  return JSON.stringify(state)
}

/** Reads a stored session back, discarding anything malformed. A session that ended while the page was closed comes back `completed`. */
export function parseStored(raw, now) {
  if (typeof raw !== 'string' || raw === '') return createState()
  let data
  try { data = JSON.parse(raw) } catch { return createState() }
  if (!data || typeof data !== 'object' || !STATUSES.has(data.status)) return createState()

  const selectedMinutes = parseMinutes(data.selectedMinutes)
  if (selectedMinutes === null) return createState()
  if (data.status === 'idle') return createState(selectedMinutes)

  const durationMs = data.durationMs
  if (!Number.isFinite(durationMs) || durationMs < MINUTE_MS || durationMs > MAX_MINUTES * MINUTE_MS) return createState(selectedMinutes)
  const base = { selectedMinutes, durationMs, endAt: null, remainingMs: 0, completedAt: null }

  if (data.status === 'running') {
    if (!Number.isFinite(data.endAt)) return createState(selectedMinutes)
    return settle({ ...base, status: 'running', endAt: data.endAt, remainingMs: durationMs }, now)
  }
  if (data.status === 'paused') {
    if (!Number.isFinite(data.remainingMs) || data.remainingMs < 0 || data.remainingMs > durationMs) return createState(selectedMinutes)
    return { ...base, status: 'paused', remainingMs: data.remainingMs }
  }
  return { ...base, status: 'completed', completedAt: Number.isFinite(data.completedAt) ? data.completedAt : null }
}
