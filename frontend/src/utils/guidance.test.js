import assert from 'node:assert/strict'
import test from 'node:test'
import { GUIDES, guidanceReducer as reduce, initialGuidanceState, isSuspended } from './guidance.js'

const run = (actions, start = initialGuidanceState) => actions.reduce(reduce, start)
const ask = (id, extra = {}) => ({ type: 'request', id, trigger: 'auto', route: '/', ...extra })
const settle = { type: 'resolve' }
const activeId = (state) => state.active?.id ?? null
const DEMO_FLYWHEEL = GUIDES.DEMO_FLYWHEEL
const ONBOARDING = GUIDES.ONBOARDING

test('only the flywheel demo, main, and first-Planner walkthroughs are requestable', () => {
  assert.deepEqual(Object.values(GUIDES), ['onboarding:demo-flywheel', 'onboarding:guide', 'planner:walkthrough'])
  for (const id of ['tour:main', 'tour:journal', 'tour:planner', 'trading-loop', 'playbook', 'mission-complete']) {
    assert.equal(reduce(initialGuidanceState, ask(id, { trigger: 'user' })), initialGuidanceState)
  }
})

test('DEMO_FLYWHEEL has priority above ONBOARDING, prevents overlap, and never chains back-to-back without navigation', () => {
  let state = run([ask(ONBOARDING), ask(DEMO_FLYWHEEL), settle])
  assert.equal(activeId(state), DEMO_FLYWHEEL)
  assert.equal(state.pending.length, 0)

  // While DEMO_FLYWHEEL is active, ONBOARDING cannot interrupt or queue
  state = reduce(state, ask(ONBOARDING))
  assert.equal(activeId(state), DEMO_FLYWHEEL)
  assert.equal(state.pending.length, 0)

  // Releasing DEMO_FLYWHEEL sets settledRoute on '/' so automatic guides wait until navigation
  state = reduce(state, { type: 'release', id: DEMO_FLYWHEEL, route: '/' })
  assert.equal(activeId(state), null)
  assert.equal(state.settledRoute, '/')
  assert.equal(reduce(state, ask(ONBOARDING, { route: '/' })).pending.length, 0)

  // Leaving the demo calls navigate('/'), which clears settledRoute and allows ONBOARDING to start
  state = reduce(state, { type: 'navigate', route: '/' })
  assert.equal(state.settledRoute, null)
  state = run([ask(ONBOARDING, { route: '/' }), settle], state)
  assert.equal(activeId(state), ONBOARDING)
})

test('a request made while the guide is active is ignored', () => {
  let state = run([ask(ONBOARDING), settle])
  state = reduce(state, ask(ONBOARDING, { route: '/planner/1', trigger: 'user' }))
  assert.equal(activeId(state), ONBOARDING)
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'release', id: ONBOARDING, route: '/' }, settle], state)
  assert.equal(activeId(state), null)
})

test('a user request is ignored while an application modal is open', () => {
  let state = reduce(initialGuidanceState, { type: 'modal', open: true })
  state = reduce(state, ask(ONBOARDING, { trigger: 'user' }))
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), null)
})

test('an automatic request waits for an application modal to close', () => {
  let state = run([{ type: 'modal', open: true }, ask(ONBOARDING), settle])
  assert.equal(activeId(state), null)
  assert.equal(state.pending.length, 1)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), ONBOARDING)
})

test('opening a real form suspends the active guide without losing its state', () => {
  let state = run([ask(ONBOARDING), settle])
  const before = state.active
  state = reduce(state, { type: 'modal', open: true })
  assert.equal(isSuspended(state), true)
  assert.equal(state.active, before)
  state = reduce(state, { type: 'modal', open: false })
  assert.equal(isSuspended(state), false)
  assert.equal(state.active, before)
})

test('a guide that ended does not relaunch automatically on that route, but a replay still works', () => {
  let state = run([ask(ONBOARDING), settle, { type: 'release', id: ONBOARDING, route: '/' }])
  state = run([ask(ONBOARDING), settle], state)
  assert.equal(activeId(state), null)
  state = run([ask(ONBOARDING, { trigger: 'user' }), settle], state)
  assert.equal(activeId(state), ONBOARDING)
})

test('navigating lifts the same-route cooldown for automatic requests', () => {
  let state = run([ask(ONBOARDING), settle, { type: 'release', id: ONBOARDING, route: '/' }])
  assert.equal(reduce(state, ask(ONBOARDING)).pending.length, 0)
  state = reduce(state, { type: 'navigate', route: '/planner/1' })
  state = run([ask(ONBOARDING, { route: '/planner/1' }), settle], state)
  assert.equal(activeId(state), ONBOARDING)
})

test('no pending request means no guide is shown', () => {
  assert.equal(run([settle, settle]).active, null)
})

test('duplicate requests are ignored and an explicit request upgrades a pending automatic one', () => {
  let state = run([ask(ONBOARDING), ask(ONBOARDING)])
  assert.equal(state.pending.length, 1)
  state = reduce(state, ask(ONBOARDING, { trigger: 'user' }))
  assert.equal(state.pending.length, 1)
  assert.equal(state.pending[0].trigger, 'user')
  state = run([settle], state)
  assert.equal(reduce(state, ask(ONBOARDING)), state)
})

test('releasing a guide before it is granted cancels its pending request', () => {
  const pending = reduce(initialGuidanceState, ask(ONBOARDING))
  const cancelled = reduce(pending, { type: 'release', id: ONBOARDING })
  assert.equal(cancelled.pending.length, 0)
  assert.equal(activeId(reduce(cancelled, settle)), null)
})

test('unknown guides and releases of inactive guides are no-ops', () => {
  const state = run([ask(ONBOARDING), settle])
  assert.equal(reduce(state, ask('unknown-guide')), state)
  assert.equal(reduce(state, { type: 'release', id: 'unknown-guide' }), state)
})
