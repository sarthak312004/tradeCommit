import { useSyncExternalStore } from 'react'
import {
  STORAGE_KEY, createState, getProgress, getRemainingMs, parseStored, pause as pauseState, reset as resetState,
  resume as resumeState, selectMinutes as selectState, serialize, settle, start as startState
} from '../utils/focusTimer'

/*
 * One focus timer for the whole page.
 *
 * The session lives in this module (not in a component), so no matter how many components call
 * useFocusTimer() there is exactly one timer, one scheduled wake-up and one set of window listeners.
 * Time is always derived from the stored end timestamp; the wake-up only asks React to re-render, it never
 * adds up elapsed ticks. State is mirrored to localStorage on every transition (not on every tick), so a refresh
 * or an accidental close resumes where it was, and a second tab of the app stays in step through `storage` events.
 *
 * The wake-up and the listeners exist only while something is subscribed, so closing Deep Mode (or the drawer)
 * releases every resource. The session itself keeps running on the clock and is picked up when Deep Mode reopens.
 */

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

const readStored = () => {
  if (!canUseStorage()) return createState()
  try { return parseStored(window.localStorage.getItem(STORAGE_KEY), Date.now()) } catch { return createState() }
}

const writeStored = (state) => {
  if (!canUseStorage()) return
  try { window.localStorage.setItem(STORAGE_KEY, serialize(state)) } catch { /* private mode / quota: timer still works for this page */ }
}

const listeners = new Set()
let state = null
let snapshot = null
let wakeTimer = null

const ensureLoaded = () => {
  if (state) return
  state = readStored()
  snapshot = { state, now: Date.now() }
}

const clearWake = () => {
  if (wakeTimer !== null) {
    clearTimeout(wakeTimer)
    wakeTimer = null
  }
}

// Re-render subscribers at the next whole-second boundary of the countdown (or at the end, whichever is first).
const scheduleWake = () => {
  clearWake()
  if (listeners.size === 0 || state.status !== 'running') return
  const remaining = getRemainingMs(state, Date.now())
  const untilNextSecond = remaining % 1000 || 1000
  wakeTimer = setTimeout(refresh, Math.min(Math.max(remaining, 0), untilNextSecond) + 15)
}

function emit() {
  snapshot = { state, now: Date.now() }
  scheduleWake()
  listeners.forEach((listener) => listener())
}

// Re-reads the clock: completes a session whose time is up and refreshes the displayed seconds.
function refresh() {
  wakeTimer = null
  const settled = settle(state, Date.now())
  if (settled !== state) {
    state = settled
    writeStored(state)
  }
  emit()
}

const commit = (next) => {
  ensureLoaded()
  if (next === state) return
  state = next
  writeStored(state)
  emit()
}

const handleStorage = (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return
  state = event.key === null ? createState() : readStored() // key === null: storage was cleared
  emit()
}

const handleVisibility = () => {
  if (document.visibilityState === 'visible') refresh()
}

function subscribe(listener) {
  ensureLoaded()
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)
    refresh() // catches up on time that passed while nothing was subscribed (Deep Mode closed, page reloaded)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearWake()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }
}

const getSnapshot = () => {
  ensureLoaded()
  return snapshot
}

const actions = {
  selectMinutes: (minutes) => { ensureLoaded(); commit(selectState(state, minutes)) },
  start: (minutes) => { ensureLoaded(); commit(startState(state, minutes, Date.now())) },
  pause: () => { ensureLoaded(); commit(pauseState(state, Date.now())) },
  resume: () => { ensureLoaded(); commit(resumeState(state, Date.now())) },
  reset: () => { ensureLoaded(); commit(resetState(state)) }
}

/**
 * @returns {{ status: 'idle'|'running'|'paused'|'completed', selectedMinutes: number, durationMs: number,
 *   remainingMs: number, progress: number, selectMinutes, start, pause, resume, reset }}
 */
export function useFocusTimer() {
  const { state: current, now } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    status: current.status,
    selectedMinutes: current.selectedMinutes,
    durationMs: current.durationMs,
    remainingMs: getRemainingMs(current, now),
    progress: getProgress(current, now),
    ...actions
  }
}
