import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEntry, normalizePlanner } from './plannerEntry.js'
import { upgradeCopy } from './upgrade.js'

test('weekly entry scope survives API normalization', () => {
  assert.equal(normalizeEntry({ id: 'weekly-1', scope: 'week' }).scope, 'week')
})

test('entries saved before scope existed remain daily plans', () => {
  assert.equal(normalizeEntry({ id: 'daily-1' }).scope, 'day')
})

test('planner normalization preserves readOnly flag for over-limit Free resources', () => {
  assert.equal(normalizePlanner({ _id: 'p1', name: 'Locked', readOnly: true }).readOnly, true)
  assert.equal(normalizePlanner({ _id: 'p2', name: 'Writable', readOnly: false }).readOnly, false)
  assert.equal(normalizePlanner({ _id: 'p3', name: 'Default' }).readOnly, false)
})

test('upgradeCopy provides specific copy for read-only journals and planners', () => {
  assert.equal(upgradeCopy('readonly_journal').title, 'Read-only journal')
  assert.equal(upgradeCopy('readonly_planner').title, 'Read-only planner')
})
