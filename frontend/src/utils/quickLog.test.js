import test from 'node:test'
import assert from 'node:assert/strict'
import { QUICK_LOG_KEY, readQuickLog, savedToastText, shouldKeepFormOpen, writeQuickLog } from './quickLog.js'

const memoryStorage = () => {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }
}

test('Quick Log is OFF by default for a first-time user', () => {
  assert.equal(readQuickLog(memoryStorage()), false)
})

test('the preference survives "closing and reopening" (a fresh read of the same storage)', () => {
  const storage = memoryStorage()
  writeQuickLog(true, storage)
  assert.equal(storage.getItem(QUICK_LOG_KEY), '1')
  assert.equal(readQuickLog(storage), true)
  writeQuickLog(false, storage)
  assert.equal(readQuickLog(storage), false)
})

test('blocked or throwing storage never breaks the form', () => {
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(readQuickLog(broken), false)
  assert.doesNotThrow(() => writeQuickLog(true, broken))
  assert.equal(readQuickLog(null), false)
})

test('only a NEW trade keeps the form open', () => {
  assert.equal(shouldKeepFormOpen({ quickLog: true, isEditing: false }), true)
  assert.equal(shouldKeepFormOpen({ quickLog: true, isEditing: true }), false)
  assert.equal(shouldKeepFormOpen({ quickLog: false, isEditing: false }), false)
  assert.equal(shouldKeepFormOpen({ quickLog: false, isEditing: true }), false)
})

test('the toast names the instrument when there is one', () => {
  assert.deepEqual(savedToastText(' eurusd '), { message: 'Trade saved successfully', detail: 'EURUSD' })
  assert.deepEqual(savedToastText(undefined), { message: 'Trade saved successfully', detail: '' })
})
