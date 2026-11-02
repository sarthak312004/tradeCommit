import assert from 'node:assert/strict'
import test from 'node:test'
import { getOnboardingWorkflowProgress } from './onboardingProgress.js'

test('new onboarding workflow starts with all real actions incomplete', () => {
  const progress = getOnboardingWorkflowProgress({ actions: [] })
  assert.equal(progress.visible, true)
  assert.equal(progress.completed, 0)
  assert.equal(progress.total, 6)
  assert.equal(progress.fraction, 0)
  assert.equal(progress.currentStage, 'plan')
})

test('progress advances only when the corresponding saved actions exist', () => {
  const progress = getOnboardingWorkflowProgress({
    actions: ['plan_created', 'planner_connected', 'journal_created', 'journal_context_saved', 'trade_logged'],
  })
  assert.deepEqual(progress.stages.map(({ completed }) => completed), [true, true, false])
  assert.equal(progress.completed, 5)
  assert.equal(progress.fraction, 5 / 6)
  assert.equal(progress.currentStage, 'feedback')
  assert.deepEqual(progress.stages[0].requiredActions.map(({ completed }) => completed), [true, true])
  assert.deepEqual(progress.stages[1].requiredActions.map(({ completed }) => completed), [true, true, true])
})

test('PLAN progress includes the saved Planner-to-journal connection', () => {
  const progress = getOnboardingWorkflowProgress({ actions: ['plan_created'] })
  assert.equal(progress.stages[0].completed, false)
  assert.deepEqual(
    progress.stages[0].requiredActions.map(({ id, label, completed }) => ({ id, label, completed })),
    [
      { id: 'plan_created', label: 'Save a plan', completed: true },
      { id: 'planner_connected', label: 'Connect Planner to a journal', completed: false },
    ]
  )

  const connected = getOnboardingWorkflowProgress({ actions: ['planner_connected'] })
  assert.equal(connected.completed, 1)
  assert.equal(connected.fraction, 1 / 6)
})

test('completed actions count linearly regardless of workflow stage order', () => {
  const progress = getOnboardingWorkflowProgress({
    actions: ['mentor_review_created', 'trade_logged'],
  })
  assert.equal(progress.completed, 2)
  assert.equal(progress.fraction, 1 / 3)
  assert.equal(progress.currentStage, 'plan')
  assert.deepEqual(progress.stages[1].requiredActions.map(({ completed }) => completed), [false, false, true])
})

test('journal stage requires a saved context and a logged trade', () => {
  const progress = getOnboardingWorkflowProgress({
    actions: ['plan_created', 'planner_connected', 'journal_created', 'trade_logged'],
  })
  assert.equal(progress.stages[1].completed, false)
  assert.equal(progress.currentStage, 'journal')
})

test('completed onboarding stays hidden regardless of later local state', () => {
  const progress = getOnboardingWorkflowProgress({
    actions: [],
    workflowCompletedAt: '2026-01-01T00:00:00.000Z',
  })
  assert.equal(progress.visible, false)
  assert.equal(progress.isComplete, true)
})

test('legacy users with no server onboarding state never see the indicator', () => {
  assert.equal(getOnboardingWorkflowProgress(null).visible, false)
})
