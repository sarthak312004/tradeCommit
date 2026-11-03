import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEntry } from './plannerEntry.js'

test('weekly entry scope survives API normalization', () => {
  assert.equal(normalizeEntry({ id: 'weekly-1', scope: 'week' }).scope, 'week')
})

test('entries saved before scope existed remain daily plans', () => {
  assert.equal(normalizeEntry({ id: 'daily-1' }).scope, 'day')
})
