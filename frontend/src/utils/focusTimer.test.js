import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createState, parseMinutes, start, pause, resume, reset, settle, selectMinutes,
  getRemainingMs, getProgress, formatClock, parseStored, serialize, MAX_MINUTES
} from './focusTimer.js'

const T0 = 1_700_000_000_000
const MIN = 60_000

test('parseMinutes accepts whole minutes in range only', () => {
  assert.equal(parseMinutes('25'), 25)
  assert.equal(parseMinutes(' 90 '), 90)
  assert.equal(parseMinutes(MAX_MINUTES), MAX_MINUTES)
  for (const bad of ['', '0', '-5', '1.5', '25m', 'abc', String(MAX_MINUTES + 1), null, undefined, NaN, 12.5]) {
    assert.equal(parseMinutes(bad), null, `expected ${String(bad)} to be rejected`)
  }
})

test('remaining time comes from the wall clock, not from ticks', () => {
  const running = start(createState(), 25, T0)
  assert.equal(running.status, 'running')
  assert.equal(getRemainingMs(running, T0), 25 * MIN)
  // a tab that was throttled for 7m13s still reads exactly right
  assert.equal(getRemainingMs(running, T0 + 7 * MIN + 13_000), 25 * MIN - 7 * MIN - 13_000)
})

test('pause freezes the time and resume continues from it', () => {
  const running = start(createState(), 15, T0)
  const paused = pause(running, T0 + 5 * MIN)
  assert.equal(paused.status, 'paused')
  assert.equal(getRemainingMs(paused, T0 + 60 * MIN), 10 * MIN) // time passing while paused changes nothing
  const resumed = resume(paused, T0 + 20 * MIN)
  assert.equal(resumed.status, 'running')
  assert.equal(getRemainingMs(resumed, T0 + 20 * MIN + 4 * MIN), 6 * MIN)
})

test('only one session at a time: start is ignored while running or paused', () => {
  const running = start(createState(), 25, T0)
  assert.equal(start(running, 90, T0 + 1000), running)
  const paused = pause(running, T0 + 1000)
  assert.equal(start(paused, 90, T0 + 2000), paused)
})

test('pause and resume are no-ops in the wrong state', () => {
  const idle = createState()
  assert.equal(pause(idle, T0), idle)
  assert.equal(resume(idle, T0), idle)
  const running = start(idle, 25, T0)
  assert.equal(resume(running, T0), running)
})

test('a session that ends is settled to completed and stays at zero', () => {
  const running = start(createState(), 15, T0)
  assert.equal(settle(running, T0 + 15 * MIN - 1), running)
  const done = settle(running, T0 + 15 * MIN + 9000)
  assert.equal(done.status, 'completed')
  assert.equal(done.completedAt, T0 + 15 * MIN)
  assert.equal(getRemainingMs(done, T0 + 99 * MIN), 0)
  assert.equal(getProgress(done, T0), 1)
})

test('pausing after the end time completes instead of pausing', () => {
  const running = start(createState(), 15, T0)
  assert.equal(pause(running, T0 + 16 * MIN).status, 'completed')
})

test('reset returns to idle with the same duration and dismisses a completed session', () => {
  const running = start(createState(), 45, T0)
  const idle = reset(pause(running, T0 + MIN))
  assert.equal(idle.status, 'idle')
  assert.equal(idle.selectedMinutes, 45)
  assert.equal(getRemainingMs(idle, T0), 45 * MIN)
  assert.equal(reset(settle(running, T0 + 46 * MIN)).status, 'idle')
})

test('selectMinutes only changes the duration while idle', () => {
  assert.equal(selectMinutes(createState(), 60).selectedMinutes, 60)
  const running = start(createState(), 25, T0)
  assert.equal(selectMinutes(running, 60), running)
  assert.equal(selectMinutes(createState(), 'oops').selectedMinutes, 25)
})

test('custom durations start a session of exactly that length; invalid ones are ignored', () => {
  const custom = start(createState(), '37', T0)
  assert.equal(custom.status, 'running')
  assert.equal(custom.selectedMinutes, 37)
  assert.equal(getRemainingMs(custom, T0), 37 * MIN)
  const idle = createState()
  assert.equal(start(idle, '0', T0), idle)
  assert.equal(start(idle, '9999', T0), idle)
})

test('progress runs from 0 to 1', () => {
  const running = start(createState(), 20, T0)
  assert.equal(getProgress(createState(), T0), 0)
  assert.equal(getProgress(running, T0), 0)
  assert.equal(getProgress(running, T0 + 5 * MIN), 0.25)
})

test('formatClock rounds up and switches to hours', () => {
  assert.equal(formatClock(25 * MIN), '25:00')
  assert.equal(formatClock(1), '00:01')
  assert.equal(formatClock(0), '00:00')
  assert.equal(formatClock(-500), '00:00')
  assert.equal(formatClock(90 * MIN), '1:30:00')
  assert.equal(formatClock(59_001), '01:00')
})

test('a running session survives a refresh and keeps its end time', () => {
  const running = start(createState(), 25, T0)
  const restored = parseStored(serialize(running), T0 + 10 * MIN)
  assert.equal(restored.status, 'running')
  assert.equal(getRemainingMs(restored, T0 + 10 * MIN), 15 * MIN)
})

test('a session that ended while the page was closed comes back completed', () => {
  const running = start(createState(), 15, T0)
  const restored = parseStored(serialize(running), T0 + 3 * 60 * MIN)
  assert.equal(restored.status, 'completed')
})

test('a paused session survives a refresh without losing time', () => {
  const paused = pause(start(createState(), 60, T0), T0 + 20 * MIN)
  const restored = parseStored(serialize(paused), T0 + 999 * MIN)
  assert.equal(restored.status, 'paused')
  assert.equal(getRemainingMs(restored, T0 + 999 * MIN), 40 * MIN)
})

test('a clock moved backwards cannot extend a session past its length', () => {
  const running = start(createState(), 15, T0)
  const restored = parseStored(serialize(running), T0 - 5 * 60 * MIN)
  assert.equal(getRemainingMs(restored, T0 - 5 * 60 * MIN), 15 * MIN)
})

test('malformed or tampered storage falls back to a clean idle timer', () => {
  const fresh = createState()
  for (const raw of [null, '', 'not json', '{}', '[]', '{"status":"running"}', '{"status":"nope","selectedMinutes":25}',
    JSON.stringify({ status: 'running', selectedMinutes: 25, durationMs: 1500000, endAt: 'soon' }),
    JSON.stringify({ status: 'paused', selectedMinutes: 25, durationMs: 1500000, remainingMs: 9e9 }),
    JSON.stringify({ status: 'running', selectedMinutes: 25, durationMs: 9e12, endAt: T0 })]) {
    assert.equal(parseStored(raw, T0).status, 'idle', `raw: ${raw}`)
  }
  assert.equal(parseStored('{}', T0).selectedMinutes, fresh.selectedMinutes)
})
