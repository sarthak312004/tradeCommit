import assert from 'node:assert/strict'
import test from 'node:test'
import { GUIDES, guidanceReducer as reduce, initialGuidanceState, isSuspended } from './guidance.js'

const run = (actions, start = initialGuidanceState) => actions.reduce(reduce, start)
const ask = (id, extra = {}) => ({ type: 'request', id, trigger: 'auto', route: '/', loopEnabled: false, ...extra })
const settle = { type: 'resolve' }
const activeId = (state) => state.active?.id ?? null

test('1. Trading Loop opens while the legacy tours are still pending (switch on)', () => {
  const state = run([
    ask(GUIDES.TOUR_MAIN, { loopEnabled: true }),
    ask(GUIDES.TOUR_JOURNAL, { loopEnabled: true }),
    ask(GUIDES.TOUR_PLANNER, { loopEnabled: true }),
    ask(GUIDES.LOOP, { loopEnabled: true }),
    settle,
  ])
  assert.equal(activeId(state), GUIDES.LOOP)
  assert.equal(state.pending.length, 0)
})

test('2. Playbook requested during another guide is ignored; it never opens by itself', () => {
  let state = run([ask(GUIDES.LOOP, { loopEnabled: true }), settle])
  state = reduce(state, ask(GUIDES.PLAYBOOK, { trigger: 'user' }))
  assert.equal(activeId(state), GUIDES.LOOP)
  assert.equal(state.pending.length, 0)
  // an automatic playbook request is refused even when nothing else is open
  assert.equal(reduce(initialGuidanceState, ask(GUIDES.PLAYBOOK)).pending.length, 0)
})

test('2b. Playbook through the loop: loop pauses, playbook owns the screen, loop resumes where it was', () => {
  let state = run([ask(GUIDES.LOOP, { loopEnabled: true, meta: { mode: 'onboarding' } }), settle])
  const seq = state.active.seq
  state = reduce(state, { type: 'handoff', from: GUIDES.LOOP, to: GUIDES.PLAYBOOK, fromMeta: { startId: 'planner' } })
  assert.equal(activeId(state), GUIDES.PLAYBOOK)
  assert.equal(state.paused.id, GUIDES.LOOP)
  state = reduce(state, { type: 'release', id: GUIDES.PLAYBOOK, route: '/' })
  assert.equal(activeId(state), GUIDES.LOOP)
  assert.equal(state.active.seq, seq)
  assert.equal(state.active.meta.startId, 'planner')
  assert.equal(state.active.meta.mode, 'onboarding')
})

test('2c. only the loop may hand off, and only to the playbook', () => {
  const state = run([ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(reduce(state, { type: 'handoff', from: GUIDES.TOUR_MAIN, to: GUIDES.PLAYBOOK }), state)
})

test('3. Planner/journal guide requested during the loop is ignored, and does not start when the loop ends', () => {
  let state = run([ask(GUIDES.LOOP, { loopEnabled: true }), settle])
  state = reduce(state, ask(GUIDES.TOUR_PLANNER, { route: '/planner/1' }))
  state = reduce(state, ask(GUIDES.TOUR_PLANNER, { route: '/planner/1', trigger: 'user' }))
  assert.equal(activeId(state), GUIDES.LOOP)
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'release', id: GUIDES.LOOP, route: '/' }, settle], state)
  assert.equal(activeId(state), null)
})

test('4. A request made while a real modal/form is open is ignored (MissionTracker click)', () => {
  let state = reduce(initialGuidanceState, { type: 'modal', open: true })
  state = reduce(state, ask(GUIDES.LOOP, { loopEnabled: true, trigger: 'user' }))
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), null)
})

test('4b. An automatic request waits for the form to close, then starts once', () => {
  let state = run([{ type: 'modal', open: true }, ask(GUIDES.LOOP, { loopEnabled: true }), settle])
  assert.equal(activeId(state), null)
  assert.equal(state.pending.length, 1)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), GUIDES.LOOP)
})

test('5. Opening a real form suspends the active guide and keeps its state; closing the form brings it back', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle])
  const before = state.active
  state = reduce(state, { type: 'modal', open: true })
  assert.equal(isSuspended(state), true)
  assert.equal(state.active, before)
  state = reduce(state, { type: 'modal', open: false })
  assert.equal(isSuspended(state), false)
  assert.equal(state.active, before)
})

test('6. Refresh restarts a pending loop; skip ends it and nothing relaunches on the same route', () => {
  // refresh = fresh state, the stored 'pending' status makes the component request again
  let state = run([ask(GUIDES.LOOP, { loopEnabled: true }), settle])
  assert.equal(activeId(state), GUIDES.LOOP)
  state = reduce(state, { type: 'release', id: GUIDES.LOOP, route: '/' }) // skip / close
  state = run([ask(GUIDES.LOOP, { loopEnabled: true }), settle], state) // the component re-asks (its status is still 'snoozed'/'pending')
  assert.equal(activeId(state), null, 'no automatic relaunch on the route where the guide just ended')
  // the Resume pill is an explicit request: it works
  state = run([ask(GUIDES.LOOP, { loopEnabled: true, trigger: 'user', meta: { mode: 'onboarding', startId: 'planner' } }), settle], state)
  assert.equal(activeId(state), GUIDES.LOOP)
  assert.equal(state.active.meta.startId, 'planner')
})

test('6b. Navigating lifts the same-route cooldown for automatic guides', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle, { type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }])
  assert.equal(reduce(state, ask(GUIDES.TOUR_JOURNAL)).pending.length, 0)
  state = reduce(state, { type: 'navigate', route: '/planner/1' })
  state = run([ask(GUIDES.TOUR_PLANNER, { route: '/planner/1' }), settle], state)
  assert.equal(activeId(state), GUIDES.TOUR_PLANNER)
})

test('7. Nothing requested (existing accounts with completed tours) means nothing opens', () => {
  assert.equal(run([settle, settle]).active, null)
})

test('8. Simultaneous requests: exactly one starts; explicit beats automatic; then priority; the rest are dropped', () => {
  let state = run([ask(GUIDES.TOUR_PLANNER), ask(GUIDES.TOUR_JOURNAL), ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
  assert.equal(state.pending.length, 0)
  state = run([{ type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }, settle], state)
  assert.equal(activeId(state), null, 'no back-to-back launch')

  state = run([ask(GUIDES.LOOP, { loopEnabled: true }), ask(GUIDES.PLAYBOOK, { trigger: 'user' }), settle])
  assert.equal(activeId(state), GUIDES.PLAYBOOK)
})

test('8b. Duplicate requests are ignored (and an explicit duplicate upgrades the waiting one)', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), ask(GUIDES.TOUR_MAIN)])
  assert.equal(state.pending.length, 1)
  state = reduce(state, ask(GUIDES.TOUR_MAIN, { trigger: 'user' }))
  assert.equal(state.pending.length, 1)
  assert.equal(state.pending[0].trigger, 'user')
  state = run([settle], state)
  assert.equal(reduce(state, ask(GUIDES.TOUR_MAIN)), state)
})

test('8c. Releasing a guide before it is granted cancels its pending request', () => {
  const pending = reduce(initialGuidanceState, ask(GUIDES.LOOP, { loopEnabled: true }))
  const cancelled = reduce(pending, { type: 'release', id: GUIDES.LOOP })
  assert.equal(cancelled.pending.length, 0)
  assert.equal(activeId(reduce(cancelled, settle)), null)
})

test('9. Switch off: the loop cannot start (even manually); legacy tours behave as before, one at a time', () => {
  assert.equal(reduce(initialGuidanceState, ask(GUIDES.LOOP, { trigger: 'user' })).pending.length, 0)
  const state = run([ask(GUIDES.TOUR_MAIN), ask(GUIDES.TOUR_JOURNAL), settle])
  assert.equal(activeId(state), GUIDES.TOUR_MAIN)
  assert.equal(state.pending.length, 0)
})

test('9b. Switch on: legacy tours never start by themselves but can still be requested by the user', () => {
  assert.equal(reduce(initialGuidanceState, ask(GUIDES.TOUR_JOURNAL, { loopEnabled: true })).pending.length, 0)
  const state = run([ask(GUIDES.TOUR_JOURNAL, { loopEnabled: true, trigger: 'user' }), settle])
  assert.equal(activeId(state), GUIDES.TOUR_JOURNAL)
})

test('unknown guide ids and releases of a guide that is not active are no-ops', () => {
  const state = run([ask(GUIDES.TOUR_MAIN), settle])
  assert.equal(reduce(state, ask('nope')), state)
  assert.equal(reduce(state, { type: 'release', id: GUIDES.LOOP }), state)
})

test('mission completion can be celebrated after a guide ends on the same route, but not over an active guide', () => {
  let state = run([ask(GUIDES.TOUR_MAIN), settle, { type: 'release', id: GUIDES.TOUR_MAIN, route: '/' }])
  state = run([ask(GUIDES.MISSION_COMPLETE), settle], state)
  assert.equal(activeId(state), GUIDES.MISSION_COMPLETE)

  const busy = run([ask(GUIDES.LOOP, { loopEnabled: true }), settle])
  assert.equal(reduce(busy, ask(GUIDES.MISSION_COMPLETE)), busy)
})

test('mission completion waits for a real modal to close', () => {
  let state = run([{ type: 'modal', open: true }, ask(GUIDES.MISSION_COMPLETE), settle])
  assert.equal(activeId(state), null)
  state = run([{ type: 'modal', open: false }, settle], state)
  assert.equal(activeId(state), GUIDES.MISSION_COMPLETE)
})
