import assert from 'node:assert/strict'
import test from 'node:test'
import { lockedFeatureBullets } from './planFeatures.js'

const limited = {
  maxJournals: 1, maxPlanners: 1, analytics: 'basic', aiWeeklyPer7Days: 1, aiRangeReviews: false, aiHistory: false,
  aiCarryForward: true, exportDays: 30, importMaxPerCommit: 50, deepMode: true, metricAccess: {}
}
const unlimited = {
  maxJournals: null, maxPlanners: null, analytics: 'full', aiWeeklyPer7Days: 3, aiRangeReviews: true, aiHistory: true,
  aiCarryForward: true, exportDays: null, importMaxPerCommit: null, deepMode: true, metricAccess: {}
}
const text = (entitlements) => lockedFeatureBullets(entitlements).map((bullet) => bullet.text)

test('bullets print the limits from the entitlements', () => {
  const lines = text(limited)
  assert.ok(lines.includes('More than 1 journal'))
  assert.ok(lines.includes('More than 1 planner'))
  assert.ok(lines.includes('Export beyond the last 30 days'))
  assert.ok(lines.includes('Import more than 50 trades at once'))
  assert.ok(lines.includes('More than 1 AI review a week'))
  assert.ok(lines.includes('AI mentor reviews for any date range'))
  assert.ok(lines.includes('AI review history'))
  assert.ok(lines.includes('Every analytics tab, metric and filter'))
})

test('changing an entitlement changes the bullet; nothing is a fixed number', () => {
  const lines = text({ ...limited, maxJournals: 3, exportDays: 90, importMaxPerCommit: 200 })
  assert.ok(lines.includes('More than 3 journals'))
  assert.ok(lines.includes('Export beyond the last 90 days'))
  assert.ok(lines.includes('Import more than 200 trades at once'))
})

test('a feature that is not limited has no bullet (moving it to Free removes it)', () => {
  const lines = text({ ...limited, aiRangeReviews: true, aiHistory: true, exportDays: null })
  assert.ok(!lines.includes('AI mentor reviews for any date range'))
  assert.ok(!lines.includes('AI review history'))
  assert.ok(!lines.some((line) => line.startsWith('Export')))
})

test('booleans that are off become bullets', () => {
  const lines = text({ ...limited, aiCarryForward: false, deepMode: false })
  assert.ok(lines.includes('AI carry-forward into your next plan'))
  assert.ok(lines.includes('Deep Mode'))
})

test('no bullets while entitlements load or when nothing is limited', () => {
  assert.deepEqual(lockedFeatureBullets(null), [])
  assert.deepEqual(lockedFeatureBullets(undefined), [])
  assert.deepEqual(lockedFeatureBullets('x'), [])
  assert.deepEqual(text({ ...unlimited, aiWeeklyPer7Days: null }), [])
})

test('every bullet has a unique id', () => {
  const ids = lockedFeatureBullets({ ...limited, aiCarryForward: false, deepMode: false }).map((bullet) => bullet.id)
  assert.equal(new Set(ids).size, ids.length)
})
