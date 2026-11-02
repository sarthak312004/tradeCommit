// The Guided Onboarding: one continuous walkthrough of the TradeCommit loop (PLAN -> JOURNAL -> AI FEEDBACK).
// Pure state + persistence helpers (no React, no DOM requirements), unit-tested with `node --test`.
//
//   queueOnboardingGuide(username)  - called once, when onboarding finishes: the guide becomes "pending"
//   getGuideState(username)         - { status, step, ... } | null (null = never queued, e.g. an account that predates it)
//   resolveGuideStep(state, facts)  - the step that should be on screen, given what exists in the account
//   getGuideProgress(state)         - { total, completed, fraction, ... } (for the Part 2 header indicator)
//
// Only a fresh sign-up is ever queued, so nobody who already knows the app is shown a guide they did not ask for.
// Progress lives in localStorage under the username (same scope the legacy tour used, and carried over on rename).

export const GUIDE_CHANGE_EVENT = 'tradecommit:onboarding-guide-change'
export const GUIDE_REPLAY_EVENT = 'tradecommit:onboarding-guide-replay'

export const GUIDE_STATUS = Object.freeze({
  PENDING: 'pending', // queued at the end of onboarding, not started yet
  IN_PROGRESS: 'in_progress', // the user has seen at least one step
  COMPLETED: 'completed', // reached the end of the AI Mentor step
  SKIPPED: 'skipped', // dismissed by the user
})

export const GUIDE_STEP = Object.freeze({
  PLANNER: 'planner',
  CREATE_JOURNAL: 'create-journal',
  JOURNAL_CONTEXT: 'journal-context',
  JOURNAL_EXECUTION: 'journal-execution',
  AI_MENTOR: 'ai-mentor',
})

/** Ordered. The loop stage each step belongs to is shown in the card: PLAN, JOURNAL, AI FEEDBACK. */
export const GUIDE_STEP_ORDER = Object.freeze([
  GUIDE_STEP.PLANNER,
  GUIDE_STEP.CREATE_JOURNAL,
  GUIDE_STEP.JOURNAL_CONTEXT,
  GUIDE_STEP.JOURNAL_EXECUTION,
  GUIDE_STEP.AI_MENTOR,
])

export const GUIDE_STAGE = Object.freeze({
  [GUIDE_STEP.PLANNER]: 'plan',
  [GUIDE_STEP.CREATE_JOURNAL]: 'journal',
  [GUIDE_STEP.JOURNAL_CONTEXT]: 'journal',
  [GUIDE_STEP.JOURNAL_EXECUTION]: 'journal',
  [GUIDE_STEP.AI_MENTOR]: 'feedback',
})

const STATE_VERSION = 1
const JOURNAL_STEPS = new Set([GUIDE_STEP.JOURNAL_CONTEXT, GUIDE_STEP.JOURNAL_EXECUTION, GUIDE_STEP.AI_MENTOR])
const STATUSES = new Set(Object.values(GUIDE_STATUS))

const storageKey = (username) => `tradecommit:onboarding-guide:v${STATE_VERSION}:${String(username).toLowerCase()}`

// ---------------------------------------------------------------------------------------------------------------
// storage (with an in-memory fallback, so a browser that refuses localStorage still gets a coherent session)
// ---------------------------------------------------------------------------------------------------------------

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
  window.dispatchEvent(new CustomEvent(GUIDE_CHANGE_EVENT, { detail: { username: String(username).toLowerCase(), state } }))
}

/** Defensive parse: anything unexpected is treated as "no state", never as an error. */
export const parseGuideState = (raw) => {
  if (!raw) return null
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!value || typeof value !== 'object') return null
    if (!STATUSES.has(value.status)) return null
    const step = GUIDE_STEP_ORDER.includes(value.step) ? value.step : GUIDE_STEP.PLANNER
    return { v: STATE_VERSION, status: value.status, step, updatedAt: Number(value.updatedAt) || 0 }
  } catch {
    return null
  }
}

export const getGuideState = (username, storage = defaultStorage()) => {
  if (!username) return null
  const key = storageKey(username)
  try {
    const stored = storage?.getItem(key)
    if (stored != null) return parseGuideState(stored)
  } catch {
    // storage unavailable: fall through to this tab's memory
  }
  return parseGuideState(memory.get(key))
}

export const saveGuideState = (username, state, storage = defaultStorage()) => {
  if (!username) return null
  const next = { v: STATE_VERSION, status: state.status, step: state.step, updatedAt: Date.now() }
  const key = storageKey(username)
  memory.set(key, JSON.stringify(next))
  try {
    storage?.setItem(key, JSON.stringify(next))
  } catch {
    // the guide just won't survive a refresh in this browser
  }
  emit(username, next)
  return next
}

const queuedState = () => ({ status: GUIDE_STATUS.PENDING, step: GUIDE_STEP.PLANNER })

/** Called once, when a brand-new account finishes onboarding. Never overrides a guide that was already finished. */
export const queueOnboardingGuide = (username, storage) => {
  if (!username) return null
  const existing = getGuideState(username, storage)
  if (existing && (existing.status === GUIDE_STATUS.COMPLETED || existing.status === GUIDE_STATUS.SKIPPED)) return existing
  return saveGuideState(username, queuedState(), storage)
}

/** "Take the guided tour" in the profile menu: always starts again from the first step. */
export const restartOnboardingGuide = (username, storage) => (username ? saveGuideState(username, { status: GUIDE_STATUS.IN_PROGRESS, step: GUIDE_STEP.PLANNER }, storage) : null)

export const setGuideStep = (username, step, storage) => saveGuideState(username, { status: GUIDE_STATUS.IN_PROGRESS, step }, storage)
export const completeOnboardingGuide = (username, storage) => saveGuideState(username, { status: GUIDE_STATUS.COMPLETED, step: GUIDE_STEP.AI_MENTOR }, storage)
export const skipOnboardingGuide = (username, storage) => {
  const current = getGuideState(username, storage)
  return saveGuideState(username, { status: GUIDE_STATUS.SKIPPED, step: current?.step ?? GUIDE_STEP.PLANNER }, storage)
}

/** Progress is stored under the username, so a rename in the Profile section must carry it over. */
export const moveGuideState = (fromUsername, toUsername, storage = defaultStorage()) => {
  if (!fromUsername || !toUsername || String(fromUsername).toLowerCase() === String(toUsername).toLowerCase()) return
  const state = getGuideState(fromUsername, storage)
  if (!state) return
  saveGuideState(toUsername, state, storage)
  memory.delete(storageKey(fromUsername))
  try {
    storage?.removeItem(storageKey(fromUsername))
  } catch {
    // nothing more to clean up
  }
}

export const requestGuideReplay = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GUIDE_REPLAY_EVENT))
}

// ---------------------------------------------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------------------------------------------

export const isGuideRunnable = (state) => state?.status === GUIDE_STATUS.PENDING || state?.status === GUIDE_STATUS.IN_PROGRESS
export const isGuideFinished = (state) => state?.status === GUIDE_STATUS.COMPLETED || state?.status === GUIDE_STATUS.SKIPPED
export const isJournalStep = (step) => JOURNAL_STEPS.has(step)

/**
 * The step that should be on screen. `facts` describes what exists in the account right now:
 *   hasJournal  a real (saved) journal exists
 *   hasTrades   at least one trade is logged
 *
 *   - Creating the journal completes `create-journal` by itself (the guide moves on and shows the journal).
 *   - A journal that disappears (deleted mid-guide) sends the guide back to `create-journal` instead of pointing at nothing.
 *   - An account that already logs trades is not onboarding any more: a guide that never started completes silently.
 *     (A replay from the profile menu is `in_progress`, so veterans can still take the guide on request.)
 */
export const resolveGuideStep = (state, facts) => {
  if (!isGuideRunnable(state)) return { status: state?.status ?? null, step: state?.step ?? null }
  // only a guide that was queued but never started: someone who asked for it (replay) or is mid-guide keeps going
  if (facts.hasTrades && state.status === GUIDE_STATUS.PENDING) return { status: GUIDE_STATUS.COMPLETED, step: GUIDE_STEP.AI_MENTOR }
  if (state.step === GUIDE_STEP.CREATE_JOURNAL && facts.hasJournal) return { status: state.status, step: GUIDE_STEP.JOURNAL_CONTEXT }
  if (isJournalStep(state.step) && !facts.hasJournal) return { status: state.status, step: GUIDE_STEP.CREATE_JOURNAL }
  return { status: state.status, step: state.step }
}

export const nextGuideStep = (step) => GUIDE_STEP_ORDER[GUIDE_STEP_ORDER.indexOf(step) + 1] ?? null

/** Back never returns to `create-journal` from the journal steps: that step completes itself once a journal exists. */
export const previousGuideStep = (step) => {
  if (step === GUIDE_STEP.JOURNAL_EXECUTION) return GUIDE_STEP.JOURNAL_CONTEXT
  if (step === GUIDE_STEP.AI_MENTOR) return GUIDE_STEP.JOURNAL_EXECUTION
  if (step === GUIDE_STEP.CREATE_JOURNAL) return GUIDE_STEP.PLANNER
  return null
}

/** For the header progress indicator (Part 2): how far along the guide is. */
export const getGuideProgress = (state) => {
  const total = GUIDE_STEP_ORDER.length
  if (!state) return { total, completed: 0, fraction: 0, status: null, step: null }
  const index = GUIDE_STEP_ORDER.indexOf(state.step)
  const completed = state.status === GUIDE_STATUS.COMPLETED ? total : Math.max(0, index)
  return { total, completed, fraction: completed / total, status: state.status, step: state.step }
}
