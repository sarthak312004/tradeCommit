// The Guided Flywheel Demo: a read-only, fixture-driven 6-step walkthrough of Plan -> Journal -> AI feedback -> next plan.
// Pure state + persistence helpers (no React, no DOM requirements), unit-tested with `node --test`.

export const DEMO_FLYWHEEL_CHANGE_EVENT = 'tradecommit:demo-flywheel-change'
export const DEMO_FLYWHEEL_REPLAY_EVENT = 'tradecommit:demo-flywheel-replay'

export const DEMO_FLYWHEEL_STATUS = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
})

export const DEMO_FLYWHEEL_STEP = Object.freeze({
  JOURNAL: 'journal',
  CONTEXT: 'context',
  PLANNER: 'planner',
  AI_MENTOR: 'ai-mentor',
  NEXT_PLAN: 'next-plan',
  FINISH: 'finish',
})

export const DEMO_FLYWHEEL_STEPS = Object.freeze([
  DEMO_FLYWHEEL_STEP.JOURNAL,
  DEMO_FLYWHEEL_STEP.CONTEXT,
  DEMO_FLYWHEEL_STEP.PLANNER,
  DEMO_FLYWHEEL_STEP.AI_MENTOR,
  DEMO_FLYWHEEL_STEP.NEXT_PLAN,
  DEMO_FLYWHEEL_STEP.FINISH,
])

export const DEMO_FLYWHEEL_STAGE = Object.freeze({
  [DEMO_FLYWHEEL_STEP.JOURNAL]: 'journal',
  [DEMO_FLYWHEEL_STEP.CONTEXT]: 'journal',
  [DEMO_FLYWHEEL_STEP.PLANNER]: 'plan',
  [DEMO_FLYWHEEL_STEP.AI_MENTOR]: 'feedback',
  [DEMO_FLYWHEEL_STEP.NEXT_PLAN]: 'plan',
  [DEMO_FLYWHEEL_STEP.FINISH]: 'feedback',
})

const STATE_VERSION = 1
const STATUSES = new Set(Object.values(DEMO_FLYWHEEL_STATUS))

const storageKey = (username) => `tradecommit:demo-flywheel:v${STATE_VERSION}:${String(username).toLowerCase()}`

const memory = new Map()

const defaultStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

const emit = (username, state) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(
    new CustomEvent(DEMO_FLYWHEEL_CHANGE_EVENT, {
      detail: { username: String(username).toLowerCase(), state },
    })
  )
}

export const parseDemoFlywheelState = (raw) => {
  if (!raw) return null
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!value || typeof value !== 'object') return null
    if (!STATUSES.has(value.status)) return null
    const step = DEMO_FLYWHEEL_STEPS.includes(value.step) ? value.step : DEMO_FLYWHEEL_STEP.JOURNAL
    return { v: STATE_VERSION, status: value.status, step, updatedAt: Number(value.updatedAt) || 0 }
  } catch {
    return null
  }
}

export const getDemoFlywheelState = (username, storage = defaultStorage()) => {
  if (!username) return null
  const key = storageKey(username)
  try {
    const stored = storage?.getItem(key)
    if (stored != null) return parseDemoFlywheelState(stored)
  } catch {
    // storage unavailable: fall through to this tab's memory
  }
  return parseDemoFlywheelState(memory.get(key))
}

export const saveDemoFlywheelStateLocal = (username, state, storage = defaultStorage()) => {
  if (!username) return null
  const step = DEMO_FLYWHEEL_STEPS.includes(state?.step) ? state.step : DEMO_FLYWHEEL_STEP.JOURNAL
  if (!STATUSES.has(state?.status)) return null
  const next = { v: STATE_VERSION, status: state.status, step, updatedAt: Date.now() }
  const key = storageKey(username)
  memory.set(key, JSON.stringify(next))
  try {
    storage?.setItem(key, JSON.stringify(next))
  } catch {
    // the demo just won't survive a refresh in this browser
  }
  emit(username, next)
  return next
}

/** Hydrates the username-keyed local fallback from the server profile. */
export const hydrateDemoFlywheelState = (username, state, storage = defaultStorage()) => {
  if (!username || !state) return null
  const updatedAt = typeof state.updatedAt === 'string' ? Date.parse(state.updatedAt) : Number(state.updatedAt)
  const next = parseDemoFlywheelState({
    status: state.status,
    step: state.step,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  })
  if (!next) return null

  const key = storageKey(username)
  memory.set(key, JSON.stringify(next))
  try {
    storage?.setItem(key, JSON.stringify(next))
  } catch {
    // the in-memory copy still keeps this tab in sync
  }
  emit(username, next)
  return next
}

export const queueDemoFlywheel = (username, storage) => {
  if (!username) return null
  const existing = getDemoFlywheelState(username, storage)
  if (existing && (existing.status === DEMO_FLYWHEEL_STATUS.COMPLETED || existing.status === DEMO_FLYWHEEL_STATUS.SKIPPED)) {
    return existing
  }
  return saveDemoFlywheelStateLocal(
    username,
    { status: DEMO_FLYWHEEL_STATUS.PENDING, step: DEMO_FLYWHEEL_STEP.JOURNAL },
    storage
  )
}

export const restartDemoFlywheel = (username, storage) => (
  username
    ? saveDemoFlywheelStateLocal(
      username,
      { status: DEMO_FLYWHEEL_STATUS.ACTIVE, step: DEMO_FLYWHEEL_STEP.JOURNAL },
      storage
    )
    : null
)

export const setDemoFlywheelStep = (username, step, storage) => (
  saveDemoFlywheelStateLocal(
    username,
    { status: DEMO_FLYWHEEL_STATUS.ACTIVE, step },
    storage
  )
)

export const completeDemoFlywheel = (username, storage) => (
  saveDemoFlywheelStateLocal(
    username,
    { status: DEMO_FLYWHEEL_STATUS.COMPLETED, step: DEMO_FLYWHEEL_STEP.FINISH },
    storage
  )
)

export const skipDemoFlywheel = (username, storage) => {
  const current = getDemoFlywheelState(username, storage)
  return saveDemoFlywheelStateLocal(
    username,
    { status: DEMO_FLYWHEEL_STATUS.SKIPPED, step: current?.step ?? DEMO_FLYWHEEL_STEP.JOURNAL },
    storage
  )
}

export const moveDemoFlywheelState = (fromUsername, toUsername, storage = defaultStorage()) => {
  if (!fromUsername || !toUsername || String(fromUsername).toLowerCase() === String(toUsername).toLowerCase()) return
  const state = getDemoFlywheelState(fromUsername, storage)
  if (!state) return
  saveDemoFlywheelStateLocal(toUsername, state, storage)
  memory.delete(storageKey(fromUsername))
  try {
    storage?.removeItem(storageKey(fromUsername))
  } catch {
    // nothing more to clean up
  }
}

export const requestDemoFlywheelReplay = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DEMO_FLYWHEEL_REPLAY_EVENT))
}

export const isDemoFlywheelRunnable = (state) => (
  state?.status === DEMO_FLYWHEEL_STATUS.PENDING || state?.status === DEMO_FLYWHEEL_STATUS.ACTIVE
)

export const isDemoFlywheelFinished = (state) => (
  state?.status === DEMO_FLYWHEEL_STATUS.COMPLETED || state?.status === DEMO_FLYWHEEL_STATUS.SKIPPED
)

export const nextDemoFlywheelStep = (step) => (
  DEMO_FLYWHEEL_STEPS[DEMO_FLYWHEEL_STEPS.indexOf(step) + 1] ?? null
)

export const previousDemoFlywheelStep = (step) => {
  const index = DEMO_FLYWHEEL_STEPS.indexOf(step)
  return index > 0 ? DEMO_FLYWHEEL_STEPS[index - 1] : null
}
