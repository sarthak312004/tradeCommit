import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveMission } from './missionSteps.js'

const journal = (id, trades = 0) => ({ id, name: `J${id}`, trades: Array.from({ length: trades }, (_, i) => ({ id: `${id}-${i}` })) })
const planner = (id, linkedJournalId = null) => ({ id, name: `P${id}`, linkedJournalId })
const status = (m) => Object.fromEntries(m.steps.map((s) => [s.id, s.done ? 'done' : s.skipped ? 'skipped' : s.locked ? 'locked' : 'open']))

test('1. fresh account: nothing done, journal is the current step, the rest wait', () => {
  const m = deriveMission({})
  assert.equal(m.doneCount, 0)
  assert.equal(m.currentId, 'journal')
  assert.deepEqual(status(m), { journal: 'open', planner: 'locked', link: 'locked', trade: 'locked', feedback: 'locked' })
})

test('2. one journal: counted as done and used as the target without asking', () => {
  const m = deriveMission({ journals: [journal('a')] })
  assert.equal(m.steps[0].done, true)
  assert.equal(m.targetJournal.id, 'a')
  assert.equal(m.needsTargetChoice, false)
  assert.equal(m.currentId, 'planner')
})

test('3. several journals: target is never picked automatically', () => {
  const m = deriveMission({ journals: [journal('a'), journal('b')], planners: [planner('p')] })
  assert.equal(m.targetJournal, null)
  assert.equal(m.needsTargetChoice, true)
  assert.equal(status(m).link, 'locked')
  const chosen = deriveMission({ journals: [journal('a'), journal('b')], planners: [planner('p')], targetJournalId: 'b' })
  assert.equal(chosen.targetJournal.id, 'b')
  assert.equal(chosen.currentId, 'link')
  assert.equal(deriveMission({ journals: [journal('a'), journal('b')], targetJournalId: 'gone' }).needsTargetChoice, true)
})

test('4. several planners: only unlinked ones are offered for linking', () => {
  const m = deriveMission({ journals: [journal('a')], planners: [planner('p1'), planner('p2', 'other'), planner('p3')] })
  assert.deepEqual(m.linkablePlanners.map((p) => p.id), ['p1', 'p3'])
  assert.equal(m.steps[2].done, false)
})

test('5. a planner already linked to the target journal is recognised', () => {
  const m = deriveMission({ journals: [journal('a'), journal('b')], planners: [planner('p', 'b')], targetJournalId: 'b' })
  assert.equal(m.steps[2].done, true)
  assert.equal(deriveMission({ journals: [journal('a'), journal('b')], planners: [planner('p', 'b')], targetJournalId: 'a' }).steps[2].done, false)
  // a link to a journal that no longer exists is not a link
  assert.equal(deriveMission({ journals: [journal('a')], planners: [planner('p', 'deleted')] }).steps[2].done, false)
})

test('6. existing trades: the trade step is done and never asked for again', () => {
  const m = deriveMission({ journals: [journal('a', 0), journal('b', 3)], targetJournalId: 'a' })
  assert.equal(m.steps[3].done, true)
  assert.equal(m.tradeCount, 3)
  const pending = deriveMission({ journals: [{ id: 'a', trades: [{ id: 't', syncState: 'saving' }] }] })
  assert.equal(pending.steps[3].done, false)
})

test('7. completed AI feedback: recognised; feedback waits until unlocked', () => {
  const base = { journals: [journal('a', 6)], planners: [planner('p', 'a')] }
  assert.equal(status(deriveMission({ ...base, mentor: { completed: false, count: 3, target: 5 } })).feedback, 'locked')
  assert.equal(deriveMission({ ...base, mentor: { completed: true } }).currentId, 'feedback')
  const all = deriveMission({ ...base, mentor: { completed: true }, feedbackSeen: true })
  assert.equal(all.complete, true)
  assert.equal(all.currentId, null)
  assert.equal(all.doneCount, 5)
})

test('7b. the server flag firstFeedbackReceived completes the feedback step by itself', () => {
  const m = deriveMission({ journals: [journal('a', 6)], planners: [planner('p', 'a')], mentor: { completed: true, firstFeedbackReceived: true } })
  assert.equal(m.steps[4].done, true)
  assert.equal(m.complete, true)
})

test('skipping planner and link resolves them but is not the same as done', () => {
  const m = deriveMission({ journals: [journal('a', 5)], skipped: ['planner', 'link'], mentor: { completed: true }, feedbackSeen: true })
  assert.equal(m.resolved, true)
  assert.equal(m.complete, false)
  assert.equal(m.doneCount, 3)
  // a skip is ignored once the step is genuinely done
  assert.equal(deriveMission({ journals: [journal('a')], planners: [planner('p')], skipped: ['planner'] }).steps[1].skipped, false)
  // other steps cannot be skipped
  assert.equal(deriveMission({ skipped: ['journal'] }).steps[0].skipped, false)
})

test('progress never decreases after a previously reached step loses its source data', () => {
  const m = deriveMission({ sticky: ['journal', 'planner', 'trade'] })
  assert.equal(m.steps[0].done, true)
  assert.equal(m.steps[1].done, true)
  assert.equal(m.steps[3].done, true)
  assert.equal(m.doneCount, 3)
  assert.equal(m.complete, false)

  const complete = deriveMission({ sticky: ['journal', 'planner', 'link', 'trade', 'feedback'] })
  assert.equal(complete.doneCount, 5)
  assert.equal(complete.complete, true)
})
