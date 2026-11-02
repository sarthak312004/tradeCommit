import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getNextPlannerWalkthroughStep,
  isPlannerWalkthroughRunnable,
  PLANNER_WALKTHROUGH_STEPS,
} from './plannerWalkthrough.js'

test('Planner walkthrough is account-state bound to its first Planner', () => {
  const state = { plannerId: 'planner-1', status: 'pending', step: 'connection' }
  assert.equal(isPlannerWalkthroughRunnable(state, 'planner-1'), true)
  assert.equal(isPlannerWalkthroughRunnable(state, 'planner-2'), false)
  assert.equal(isPlannerWalkthroughRunnable({ ...state, status: 'completed' }, 'planner-1'), false)
  assert.equal(isPlannerWalkthroughRunnable({ ...state, status: 'skipped' }, 'planner-1'), false)
})

test('Planner walkthrough steps remain ordered and terminate after Full Editor', () => {
  assert.deepEqual(PLANNER_WALKTHROUGH_STEPS, ['connection', 'open-plan', 'deep-mode', 'quick-plan', 'full-editor'])
  assert.equal(getNextPlannerWalkthroughStep('connection'), 'open-plan')
  assert.equal(getNextPlannerWalkthroughStep('open-plan'), 'deep-mode')
  assert.equal(getNextPlannerWalkthroughStep('deep-mode'), 'quick-plan')
  assert.equal(getNextPlannerWalkthroughStep('quick-plan'), 'full-editor')
  assert.equal(getNextPlannerWalkthroughStep('full-editor'), null)
})
