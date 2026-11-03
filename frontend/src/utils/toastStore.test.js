import test from 'node:test'
import assert from 'node:assert/strict'
import { createToastStore } from './toastStore.js'

const make = (options) => createToastStore({ duration: 1000, exitMs: 100, maxVisible: 3, ...options })

test('a toast shows, then leaves and is removed after its duration', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const store = make()
  store.show({ message: 'Trade saved successfully', detail: 'EURUSD' })
  assert.equal(store.getSnapshot().length, 1)
  t.mock.timers.tick(1000)
  assert.equal(store.getSnapshot()[0].leaving, true)
  t.mock.timers.tick(100)
  assert.equal(store.getSnapshot().length, 0)
})

test('a persistent saving toast can be updated to a timed success toast', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const store = make()
  const id = store.show({ message: 'Saving trade...', detail: 'EURUSD', tone: 'pending', duration: null })

  assert.equal(store.getSnapshot()[0].message, 'Saving trade...')
  t.mock.timers.tick(5000)
  assert.equal(store.getSnapshot().length, 1)

  assert.equal(store.update(id, { message: 'Trade saved successfully', detail: 'EURUSD' }), true)
  assert.equal(store.getSnapshot()[0].tone, 'success')
  t.mock.timers.tick(1000)
  assert.equal(store.getSnapshot()[0].leaving, true)
  t.mock.timers.tick(100)
  assert.equal(store.getSnapshot().length, 0)
})

test('updating a removed toast reports that it no longer exists', () => {
  const store = make()
  assert.equal(store.update(99, { message: 'saved' }), false)
})

test('consecutive saves stack and never exceed the visible maximum', () => {
  const store = make()
  for (let i = 0; i < 6; i += 1) store.show({ message: `saved ${i}` })
  const messages = store.getSnapshot().map((toast) => toast.message)
  assert.deepEqual(messages, ['saved 3', 'saved 4', 'saved 5'])
  store.clear()
})

test('every toast gets its own id', () => {
  const store = make()
  const a = store.show({ message: 'a' })
  const b = store.show({ message: 'b' })
  assert.notEqual(a, b)
  store.clear()
})

test('dismiss is idempotent and clear() leaves no timers running', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const store = make()
  const id = store.show({ message: 'x' })
  store.dismiss(id)
  store.dismiss(id)
  store.show({ message: 'y' })
  store.clear()
  assert.equal(store.getSnapshot().length, 0)
  t.mock.timers.tick(5000) // nothing left to fire: would throw or re-emit if a timer survived
  assert.equal(store.getSnapshot().length, 0)
})

test('subscribers are notified and can unsubscribe', () => {
  const store = make()
  let calls = 0
  const off = store.subscribe(() => { calls += 1 })
  store.show({ message: 'a' })
  const seen = calls
  off()
  store.show({ message: 'b' })
  assert.equal(calls, seen)
  store.clear()
})
