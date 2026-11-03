import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { pathToFileURL, fileURLToPath } from 'node:url'
import {
  METRIC_LABELS,
  TAB_METRICS,
  accessStatus,
  canViewMetric,
  hasMetricAccess,
  isTabLocked,
  lockedMetricIds,
  metricLabel
} from '../config/analyticsAccess.js'

// What GET /auth/profile returns as `entitlements.metricAccess`, built by hand for the cases below.
const everyMetric = (allowed) => Object.fromEntries(Object.keys(METRIC_LABELS).map((id) => [id, allowed(id)]))
const BASIC = new Set(['totalTrades', 'winRate', 'netPnl', 'winsLosses', 'avgWinLoss', 'bestWorstTrade', 'avgRiskReward', 'equityCurve', 'monthlyPnl', 'longShort'])
const free = { metricAccess: everyMetric((id) => BASIC.has(id)) }
const pro = { metricAccess: everyMetric(() => true) }

test('canViewMetric: nothing is visible until the profile has loaded', () => {
  for (const entitlements of [undefined, null, {}, { metricAccess: null }, { metricAccess: undefined }, 'free', 42]) {
    assert.equal(canViewMetric('winRate', entitlements), false, String(entitlements))
  }
})

test('canViewMetric: a metric the server did not list is locked, never open', () => {
  assert.equal(canViewMetric('someFutureMetric', free), false)
  assert.equal(canViewMetric('someFutureMetric', pro), false)
  assert.equal(canViewMetric(undefined, pro), false)
  assert.equal(canViewMetric('__proto__', pro), false)
  assert.equal(canViewMetric('constructor', pro), false)
  assert.equal(canViewMetric('toString', pro), false)
})

test('canViewMetric: only an explicit true counts', () => {
  const sloppy = { metricAccess: { winRate: 'true', netPnl: 1, totalTrades: {}, equityCurve: true, monthlyPnl: false } }
  assert.equal(canViewMetric('winRate', sloppy), false)
  assert.equal(canViewMetric('netPnl', sloppy), false)
  assert.equal(canViewMetric('totalTrades', sloppy), false)
  assert.equal(canViewMetric('monthlyPnl', sloppy), false)
  assert.equal(canViewMetric('equityCurve', sloppy), true)
})

test('canViewMetric: free sees what the server marks accessible, pro sees everything', () => {
  for (const id of Object.keys(METRIC_LABELS)) {
    assert.equal(canViewMetric(id, free), BASIC.has(id), `free ${id}`)
    assert.equal(canViewMetric(id, pro), true, `pro ${id}`)
  }
})

test('canViewMetric follows the server answer, so moving a metric between plans needs no frontend change', () => {
  const moved = { metricAccess: { ...free.metricAccess, profitFactor: true, winRate: false } }
  assert.equal(canViewMetric('profitFactor', moved), true)
  assert.equal(canViewMetric('winRate', moved), false)
})

test('hasMetricAccess and accessStatus: loading, ready and error', () => {
  assert.equal(hasMetricAccess(free), true)
  assert.equal(hasMetricAccess({}), false)
  assert.equal(hasMetricAccess({ metricAccess: [] }), false)
  assert.equal(accessStatus({ profile: null, error: '' }), 'loading')
  assert.equal(accessStatus({}), 'loading')
  assert.equal(accessStatus({ profile: null, error: 'Network down' }), 'error')
  assert.equal(accessStatus({ profile: { username: 'a', entitlements: free } }), 'ready')
  // a profile without entitlements (an older server) is an error, not "everything locked" and not "everything open"
  assert.equal(accessStatus({ profile: { username: 'a' } }), 'error')
})

test('lockedMetricIds lists each locked id once, in order', () => {
  assert.deepEqual(lockedMetricIds(['winRate', 'profitFactor', 'expectancy', 'profitFactor'], free), ['profitFactor', 'expectancy'])
  assert.deepEqual(lockedMetricIds(['winRate', 'profitFactor'], pro), [])
  assert.deepEqual(lockedMetricIds(['winRate'], null), ['winRate'])
})

test('isTabLocked: a tab is locked only when every one of its metrics is', () => {
  assert.equal(isTabLocked('overview', free), false) // free keeps the basic overview
  assert.equal(isTabLocked('breakdown', free), true)
  assert.equal(isTabLocked('distribution', free), true)
  assert.equal(isTabLocked('compare', free), true)
  for (const tab of Object.keys(TAB_METRICS)) assert.equal(isTabLocked(tab, pro), false, tab)
  const oneOpen = { metricAccess: { ...everyMetric(() => false), dayOfWeek: true } }
  assert.equal(isTabLocked('breakdown', oneOpen), false)
  assert.equal(isTabLocked('nonexistent', free), false)
})

test('every labelled metric belongs to a tab (or is the filters), and every tab metric has a label', () => {
  const tabbed = new Set(Object.values(TAB_METRICS).flat())
  for (const id of Object.keys(METRIC_LABELS)) assert.ok(tabbed.has(id) || id === 'analyticsFilters', `${id} is in no tab`)
  for (const id of tabbed) assert.ok(METRIC_LABELS[id], `${id} has no label`)
  assert.equal(metricLabel('winRate'), 'Win rate')
  assert.equal(metricLabel('unknown'), 'This metric')
})

test('the frontend ids match the backend plan config, and the default Free tiers open exactly the free metrics', async (t) => {
  const file = fileURLToPath(new URL('../../../backend/src/config/plans.config.js', import.meta.url))
  if (!existsSync(file)) return t.skip('backend sources are not next to the frontend')
  const { METRIC_TIERS } = await import(pathToFileURL(file).href)
  assert.deepEqual(Object.keys(METRIC_LABELS).sort(), Object.keys(METRIC_TIERS).sort())
  // what the server sends for a free user is derived from METRIC_TIERS, and the adapter must agree with it
  const serverFree = { metricAccess: Object.fromEntries(Object.entries(METRIC_TIERS).map(([id, tier]) => [id, tier === 'free'])) }
  for (const [id, tier] of Object.entries(METRIC_TIERS)) assert.equal(canViewMetric(id, serverFree), tier === 'free', id)
  assert.equal(isTabLocked('overview', serverFree), false)
})
