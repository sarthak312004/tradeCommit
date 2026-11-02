import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GUIDE_STATUS as S,
  GUIDE_STEP as STEP,
  getGuideProgress,
  getGuideState,
  isGuideFinished,
  isGuideRunnable,
  moveGuideState,
  nextGuideStep,
  parseGuideState,
  previousGuideStep,
  queueOnboardingGuide,
  restartOnboardingGuide,
  resolveGuideStep,
  completeOnboardingGuide,
  setGuideStep,
  skipOnboardingGuide,
} from './onboardingGuide.js'

const fakeStorage = () => {
  const map = new Map()
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map }
}
const none = { hasJournal: false, hasTrades: false }

test('accounts that were never queued have no guide (existing users are never forced through it)', () => {
  const storage = fakeStorage()
  assert.equal(getGuideState('veteran', storage), null)
  assert.equal(isGuideRunnable(null), false)
  assert.equal(resolveGuideStep(null, none).status, null)
})

test('queueing starts at the planner step and survives a reload', () => {
  const storage = fakeStorage()
  queueOnboardingGuide('Ada', storage)
  const reloaded = getGuideState('ada', storage) // username is case-insensitive
  assert.equal(reloaded.status, S.PENDING)
  assert.equal(reloaded.step, STEP.PLANNER)
})

test('a finished guide is never queued again', () => {
  const storage = fakeStorage()
  queueOnboardingGuide('ada', storage)
  completeOnboardingGuide('ada', storage)
  assert.equal(queueOnboardingGuide('ada', storage).status, S.COMPLETED)
  skipOnboardingGuide('bob', storage)
  assert.equal(queueOnboardingGuide('bob', storage).status, S.SKIPPED)
})

test('progress is remembered per step; skipping keeps the step but ends the guide', () => {
  const storage = fakeStorage()
  setGuideStep('ada', STEP.JOURNAL_CONTEXT, storage)
  assert.equal(getGuideState('ada', storage).step, STEP.JOURNAL_CONTEXT)
  skipOnboardingGuide('ada', storage)
  const state = getGuideState('ada', storage)
  assert.equal(state.status, S.SKIPPED)
  assert.equal(isGuideFinished(state), true)
  assert.equal(isGuideRunnable(state), false)
})

test('replay always restarts from the planner', () => {
  const storage = fakeStorage()
  completeOnboardingGuide('ada', storage)
  const state = restartOnboardingGuide('ada', storage)
  assert.deepEqual([state.status, state.step], [S.IN_PROGRESS, STEP.PLANNER])
})

test('corrupt or foreign storage values are ignored, not thrown', () => {
  assert.equal(parseGuideState('{nope'), null)
  assert.equal(parseGuideState('"pending"'), null)
  assert.equal(parseGuideState(JSON.stringify({ status: 'weird', step: 'planner' })), null)
  assert.equal(parseGuideState(JSON.stringify({ status: S.PENDING, step: 'gone' })).step, STEP.PLANNER)
})

test('creating the journal completes create-journal by itself', () => {
  const state = { status: S.IN_PROGRESS, step: STEP.CREATE_JOURNAL }
  assert.equal(resolveGuideStep(state, none).step, STEP.CREATE_JOURNAL)
  assert.equal(resolveGuideStep(state, { hasJournal: true, hasTrades: false }).step, STEP.JOURNAL_CONTEXT)
})

test('a deleted journal sends the guide back instead of pointing at nothing', () => {
  const state = { status: S.IN_PROGRESS, step: STEP.AI_MENTOR }
  assert.equal(resolveGuideStep(state, none).step, STEP.CREATE_JOURNAL)
})

test('an account that already logs trades completes silently', () => {
  const state = { status: S.PENDING, step: STEP.PLANNER }
  assert.equal(resolveGuideStep(state, { hasJournal: true, hasTrades: true }).status, S.COMPLETED)
})

test('a replay by an account with trades is not cut short', () => {
  const state = { status: S.IN_PROGRESS, step: STEP.PLANNER }
  assert.equal(resolveGuideStep(state, { hasJournal: true, hasTrades: true }).status, S.IN_PROGRESS)
})

test('a finished guide resolves to itself', () => {
  assert.equal(resolveGuideStep({ status: S.SKIPPED, step: STEP.PLANNER }, { hasJournal: true, hasTrades: false }).status, S.SKIPPED)
})

test('step navigation', () => {
  assert.equal(nextGuideStep(STEP.PLANNER), STEP.CREATE_JOURNAL)
  assert.equal(nextGuideStep(STEP.AI_MENTOR), null)
  assert.equal(previousGuideStep(STEP.JOURNAL_CONTEXT), null)
  assert.equal(previousGuideStep(STEP.AI_MENTOR), STEP.JOURNAL_EXECUTION)
})

test('progress for the header indicator', () => {
  assert.equal(getGuideProgress(null).fraction, 0)
  assert.equal(getGuideProgress({ status: S.IN_PROGRESS, step: STEP.JOURNAL_CONTEXT }).completed, 2)
  assert.equal(getGuideProgress({ status: S.COMPLETED, step: STEP.AI_MENTOR }).fraction, 1)
})

test('renaming the account carries the guide over', () => {
  const storage = fakeStorage()
  setGuideStep('old_name', STEP.JOURNAL_EXECUTION, storage)
  moveGuideState('old_name', 'new_name', storage)
  assert.equal(getGuideState('new_name', storage).step, STEP.JOURNAL_EXECUTION)
  assert.equal(getGuideState('old_name', storage), null)
})
