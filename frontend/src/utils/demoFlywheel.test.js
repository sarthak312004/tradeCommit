import assert from 'node:assert/strict'
import test from 'node:test'
import {
  completeDemoFlywheel,
  DEMO_FLYWHEEL_STATUS,
  DEMO_FLYWHEEL_STEP,
  DEMO_FLYWHEEL_STEPS,
  getDemoFlywheelState,
  hydrateDemoFlywheelState,
  isDemoFlywheelFinished,
  isDemoFlywheelRunnable,
  moveDemoFlywheelState,
  nextDemoFlywheelStep,
  parseDemoFlywheelState,
  previousDemoFlywheelStep,
  queueDemoFlywheel,
  restartDemoFlywheel,
  setDemoFlywheelStep,
  skipDemoFlywheel,
} from './demoFlywheel.js'

const makeStorage = () => {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
}

test('step order walks all 6 flywheel demo steps forward and backward', () => {
  assert.deepEqual(DEMO_FLYWHEEL_STEPS, [
    'journal',
    'context',
    'planner',
    'ai-mentor',
    'next-plan',
    'finish',
  ])
  assert.equal(previousDemoFlywheelStep(DEMO_FLYWHEEL_STEP.JOURNAL), null)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.JOURNAL), DEMO_FLYWHEEL_STEP.CONTEXT)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.CONTEXT), DEMO_FLYWHEEL_STEP.PLANNER)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.PLANNER), DEMO_FLYWHEEL_STEP.AI_MENTOR)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.AI_MENTOR), DEMO_FLYWHEEL_STEP.NEXT_PLAN)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.NEXT_PLAN), DEMO_FLYWHEEL_STEP.FINISH)
  assert.equal(nextDemoFlywheelStep(DEMO_FLYWHEEL_STEP.FINISH), null)
  assert.equal(previousDemoFlywheelStep(DEMO_FLYWHEEL_STEP.FINISH), DEMO_FLYWHEEL_STEP.NEXT_PLAN)
})

test('existing accounts stay null while queued accounts advance, complete, skip, and replay cleanly', () => {
  const storage = makeStorage()
  assert.equal(getDemoFlywheelState('existing_user', storage), null)
  assert.equal(isDemoFlywheelRunnable(getDemoFlywheelState('existing_user', storage)), false)

  const queued = queueDemoFlywheel('new_user', storage)
  assert.equal(queued.status, DEMO_FLYWHEEL_STATUS.PENDING)
  assert.equal(queued.step, DEMO_FLYWHEEL_STEP.JOURNAL)
  assert.equal(isDemoFlywheelRunnable(queued), true)

  const active = setDemoFlywheelStep('new_user', DEMO_FLYWHEEL_STEP.PLANNER, storage)
  assert.equal(active.status, DEMO_FLYWHEEL_STATUS.ACTIVE)
  assert.equal(active.step, DEMO_FLYWHEEL_STEP.PLANNER)
  assert.equal(isDemoFlywheelRunnable(active), true)

  const completed = completeDemoFlywheel('new_user', storage)
  assert.equal(completed.status, DEMO_FLYWHEEL_STATUS.COMPLETED)
  assert.equal(completed.step, DEMO_FLYWHEEL_STEP.FINISH)
  assert.equal(isDemoFlywheelRunnable(completed), false)
  assert.equal(isDemoFlywheelFinished(completed), true)

  // queueDemoFlywheel never overwrites a completed or skipped demo
  assert.equal(queueDemoFlywheel('new_user', storage).status, DEMO_FLYWHEEL_STATUS.COMPLETED)

  // explicit replay restarts at step 1
  const replayed = restartDemoFlywheel('new_user', storage)
  assert.equal(replayed.status, DEMO_FLYWHEEL_STATUS.ACTIVE)
  assert.equal(replayed.step, DEMO_FLYWHEEL_STEP.JOURNAL)
  assert.equal(isDemoFlywheelRunnable(replayed), true)

  // skip preserves current step and marks skipped
  setDemoFlywheelStep('new_user', DEMO_FLYWHEEL_STEP.AI_MENTOR, storage)
  const skipped = skipDemoFlywheel('new_user', storage)
  assert.equal(skipped.status, DEMO_FLYWHEEL_STATUS.SKIPPED)
  assert.equal(skipped.step, DEMO_FLYWHEEL_STEP.AI_MENTOR)
  assert.equal(isDemoFlywheelRunnable(skipped), false)
  assert.equal(isDemoFlywheelFinished(skipped), true)
})

test('hydrateDemoFlywheelState, parseDemoFlywheelState, and moveDemoFlywheelState handle edge cases safely', () => {
  const storage = makeStorage()
  assert.equal(parseDemoFlywheelState(null), null)
  assert.equal(parseDemoFlywheelState('{bad json'), null)
  assert.equal(parseDemoFlywheelState({ status: 'invalid', step: 'journal' }), null)
  assert.equal(parseDemoFlywheelState({ status: 'active', step: 'unknown' }).step, 'journal')

  const hydrated = hydrateDemoFlywheelState(
    'TraderOne',
    { status: 'completed', step: 'finish', updatedAt: '2026-11-05T10:00:00.000Z' },
    storage
  )
  assert.equal(hydrated.status, 'completed')
  assert.equal(hydrated.step, 'finish')

  moveDemoFlywheelState('TraderOne', 'TraderTwo', storage)
  assert.equal(getDemoFlywheelState('TraderTwo', storage)?.status, 'completed')
})
