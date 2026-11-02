import assert from 'node:assert/strict'
import test from 'node:test'
import { GUIDES, guidanceReducer as reduce, initialGuidanceState, isSuspended, tourGuideId, tourIdOf } from './guidance.js'

const run = (actions, start = initialGuidanceState) => actions.reduce(reduce, start)
const ask = (id, extra = {}) => ({ type: 'request', id, trigger: 'auto', route: '/', ...extra })
const settle = { type: 'resolve' }
const activeId = (state) => state.active?.id ?? null

test('only Product Tour guides are requestable', () => {
  assert.deepEqual(Object.values(GUIDES).sort(), ['tour:journal', 'tour:main', 'tour:planner'])
  for (const id of ['trading-loop', 'trading-loop-preview', 'playbook', 'mission-complete']) {
    assert.equal(reduce(initialGuidanceState, ask(id, { trigger: 'user' })), initialGuidanceState)
  }
})

test('tour id helpers round-trip', () => {
  assert.equal(tourGuideId('main'), GUIDES.TOUR_MAIN)
  assert.equal(tourIdOf(GUIDES.TOUR_PLANNER), 'planner')
  assert.equal(tourIdOf('playbook'), null)
  assert.equal(tourIdOf(null), null)
})

test('a request made while a guide is active is ignored', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle])
  state = reduce(state, ask(GUIDES.TOUR_PLANNER, { route: '/planner/1' }))
  state = reduce(state, ask(GUIDES.TOUR_PLANNER, { route: '/planner/1', trigger: 'user' }))
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }, settle], state)
  assert.equal(activeId(state), null)
})

test('a user request is ignored while an application modal is open', () => {
  let state = reduce(initialGuidanceState, { type: 'modal', open: true })
  state = reduce(state, ask(GUIDES.TOUR_MAIN, { trigger: 'user' }))
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), null)
})

test('an automatic request waits for an application modal to close', () => {
  let state = run([{ type: 'modal', open: true }, ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(activeId(state), null)
  assert.equal(state.pending.length, 1)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
})

test('opening a real form suspends the active guide without losing its state', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle])
  const before = state.active
  state = reduce(state, { type: 'modal', open: true })
  assert.equal(isSuspended(state), true)
  assert.equal(state.active, before)
  state = reduce(state, { type: 'modal', open: false })
  assert.equal(isSuspended(state), false)
  assert.equal(state.active, before)
})

test('a tour that ended does not relaunch automatically, but profile replay still works', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle, { type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }])
  state = run([ask(GUIDES.TOUR_MAIN), settle], state)
  assert.equal(activeId(state), null)
  state = run([ask(GUIDES.TOUR_MAIN, { trigger: 'user' }), settle], state)
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
})

test('navigating lifts the same-route cooldown for automatic tours', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle, { type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }])
  assert.equal(reduce(state, ask(GUIDES.TOUR_JOURNAL)).pending.length, 0)
  state = reduce(state, { type: 'navigate', route: '/planner/1' })
  state = run([ask(GUIDES.TOUR_PLANNER, { route: '/planner/1' }), settle], state)
  assert.equal(activeId(state), GUIDES.TOUR_PLANNER)
})

test('no pending request means no guide is shown', () => {
  assert.equal(run([settle, settle]).active, null)
})

test('simultaneous requests start only one; explicit requests win, then tour priority', () => {
  let state = run([ask(GUIDES.TOUR_PLANNER), ask(GUIDES.TOUR_JOURNAL), ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }, settle], state)
  assert.equal(activeId(state), null)

  state = run([ask(GUIDES.TOUR_MAIN), ask(GUIDES.TOUR_PLANNER, { trigger: 'user' }), settle])
  assert.equal(activeId(state), GUIDES.TOUR_PLANNER)
})

test('duplicate requests are ignored and an explicit request upgrades a pending automatic one', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), ask(GUIDES.TOUR_MAIN)])
  assert.equal(state.pending.length, 1)
  state = reduce(state, ask(GUIDES.TOUR_MAIN, { trigger: 'user' }))
  assert.equal(state.pending.length, 1)
  assert.equal(state.pending[0].trigger, 'user')
  state = run([settle], state)
  assert.equal(reduce(state, ask(GUIDES.TOUR_MAIN)), state)
})

test('releasing a guide before it is granted cancels its pending request', () => {
  const pending = reduce(initialGuidanceState, ask(GUIDES.TOUR_MAIN))
  const cancelled = reduce(pending, { type: 'release', id: GUIDES.TOUR_MAIN })
  assert.equal(cancelled.pending.length, 0)
  assert.equal(activeId(reduce(cancelled, settle)), null)
})

test('unknown guides and releases of inactive guides are no-ops', () => {
  const state = run([ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(reduce(state, ask('unknown-guide')), state)
  assert.equal(reduce(state, { type: 'release', id: GUIDES.TOUR_JOURNAL }), state)
})
