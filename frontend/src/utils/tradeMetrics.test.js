import test from 'node:test'
import assert from 'node:assert/strict'
import { computeAnalytics, getTradePnl, getTradeR, sampleLevel } from './tradeMetrics.js'
import { canViewMetric, METRIC_ACCESS } from '../config/analyticsAccess.js'

let day = 0
const trade = (over) => {
  day += 1
  return { date: `2026-01-${String(day).padStart(2, '0')}`, direction: 'long', quantity: 1, entryPrice: 100, exitPrice: 110, ...over }
}
const closedSet = (pnls) => pnls.map((p) => trade({ exitPrice: 100 + p }))

test('empty and invalid input never throws or invents numbers', () => {
  for (const input of [[], undefined, null, [null]]) {
    const s = computeAnalytics(input)
    assert.equal(s.closedTrades, 0)
    assert.equal(s.winRate, null)
    assert.equal(s.profitFactor, null)
    assert.equal(s.recoveryFactor, null)
    assert.equal(s.expectancy, null)
    assert.equal(s.bestTrade, null)
    assert.deepEqual(s.monthly, [])
    assert.equal(s.sample.level, 'none')
  }
})

test('P&L respects direction and R needs a stop', () => {
  assert.equal(getTradePnl({ direction: 'short', entryPrice: 100, exitPrice: 90, quantity: 2 }), 20)
  assert.equal(getTradePnl({ direction: 'long', entryPrice: 100, exitPrice: 90, quantity: 2 }), -20)
  assert.equal(getTradePnl({ direction: 'long', entryPrice: 100, quantity: 2 }), null)
  assert.equal(getTradeR({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 1 }), null)
  assert.equal(getTradeR({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 1, stopLoss: 100 }), null)
  assert.equal(getTradeR({ direction: 'long', entryPrice: 100, exitPrice: 110, quantity: 1, stopLoss: 95 }), 2)
})

test('open trades are excluded; incomplete trades are reported, not counted', () => {
  const s = computeAnalytics([
    trade({ exitPrice: 120 }),
    trade({ exitPrice: undefined }), // open
    trade({ exitPrice: '' }), // open
    trade({ exitPrice: 90, entryPrice: undefined }), // exit but no entry: incomplete
    trade({ exitPrice: 90, quantity: undefined }) // incomplete
  ])
  assert.equal(s.totalTrades, 5)
  assert.equal(s.closedTrades, 1)
  assert.equal(s.openTrades, 2)
  assert.equal(s.incompleteTrades, 2)
  assert.equal(s.netPnl, 20)
})

test('core metrics from known trades', () => {
  const s = computeAnalytics(closedSet([30, -10, 20, -20, 0]))
  assert.equal(s.closedTrades, 5)
  assert.equal(s.wins, 2)
  assert.equal(s.losses, 2)
  assert.equal(s.breakevenTrades, 1)
  assert.equal(s.netPnl, 20)
  assert.equal(s.winRate, 0.4)
  assert.equal(s.avgWin, 25)
  assert.equal(s.avgLoss, 15)
  assert.equal(s.profitFactor, 50 / 30)
  assert.equal(s.expectancy, 4)
  assert.equal(s.bestTrade, 30)
  assert.equal(s.worstTrade, -20)
})

test('zero losses: profit factor is Infinity, recovery factor null, no divide by zero', () => {
  const s = computeAnalytics(closedSet([10, 20]))
  assert.equal(s.profitFactor, Infinity)
  assert.equal(s.maxDrawdown, 0)
  assert.equal(s.recoveryFactor, null)
  assert.equal(s.avgLoss, null)
  assert.equal(s.payoffRatio, null)
  assert.equal(s.lossStreak, 0)
  const flat = computeAnalytics(closedSet([0, 0]))
  assert.equal(flat.profitFactor, null)
})

test('drawdown and recovery factor', () => {
  // equity: 10, 30, 10, 0, 25  -> peak 30, trough 0 => max drawdown 30; net 25
  const s = computeAnalytics(closedSet([10, 20, -20, -10, 25]))
  assert.equal(s.maxDrawdown, 30)
  assert.equal(s.netPnl, 25)
  assert.equal(s.recoveryFactor, 25 / 30)
  assert.equal(s.currentDrawdown, 5) // 25 vs peak 30
  // drawdown from the very first trade counts (equity anchored at 0)
  assert.equal(computeAnalytics(closedSet([-15, 5])).maxDrawdown, 15)
})

test('streaks: breakeven breaks a run, current streak is the live one', () => {
  const s = computeAnalytics(closedSet([5, 5, 5, 0, 5, -1, -1, -1, -1, 3, 3]))
  assert.equal(s.winStreak, 3)
  assert.equal(s.lossStreak, 4)
  assert.deepEqual(s.currentStreak, { type: 'win', length: 2 })
  assert.deepEqual(computeAnalytics(closedSet([5, 0])).currentStreak, { type: null, length: 0 })
})

test('same-day trades keep logged order for the equity curve', () => {
  const s = computeAnalytics([
    { ...trade({ exitPrice: 90 }), date: '2026-02-01', createdAt: '2026-02-01T10:00:00Z' },
    { ...trade({ exitPrice: 130 }), date: '2026-02-01', createdAt: '2026-02-01T09:00:00Z' }
  ])
  assert.deepEqual(s.equity.map((p) => p.value), [0, 30, 20])
})

test('R metrics only use trades with a stop loss', () => {
  const s = computeAnalytics([
    trade({ stopLoss: 95, exitPrice: 110 }), // +2R
    trade({ stopLoss: 95, exitPrice: 95 }), // -1R
    trade({ exitPrice: 150 }) // no stop: excluded from R
  ])
  assert.equal(s.rSample, 2)
  assert.equal(s.avgR, 0.5)
  assert.equal(s.avgWinR, 2)
  assert.equal(s.avgLossR, 1)
  assert.equal(s.rewardRisk, 2)
  assert.equal(s.closedTrades, 3)
})

test('risk consistency needs enough stops and measures spread', () => {
  const few = computeAnalytics([trade({ stopLoss: 95 }), trade({ stopLoss: 95 })])
  assert.equal(few.riskConsistency.level, null)
  assert.equal(few.riskConsistency.withStop, 2)

  const steady = computeAnalytics(Array.from({ length: 6 }, () => trade({ stopLoss: 95 })))
  assert.equal(steady.riskConsistency.cv, 0)
  assert.equal(steady.riskConsistency.level, 'consistent')

  const wild = computeAnalytics([1, 1, 1, 1, 1, 30].map((q) => trade({ stopLoss: 95, quantity: q })))
  assert.equal(wild.riskConsistency.level, 'varied')
  assert.ok(wild.riskConsistency.maxToAvg > 3)
  assert.equal(wild.riskConsistency.stopCoverage, 1)
})

test('monthly P&L groups closed trades only, sorted oldest to newest', () => {
  const s = computeAnalytics([
    { ...trade({ exitPrice: 110 }), date: '2026-03-02' },
    { ...trade({ exitPrice: 95 }), date: '2026-01-15' },
    { ...trade({ exitPrice: 120 }), date: '2026-03-20' },
    { ...trade({ exitPrice: undefined }), date: '2026-02-10' } // open: no February row
  ])
  assert.deepEqual(s.monthly.map((m) => [m.month, m.pnl, m.trades]), [['2026-01', -5, 1], ['2026-03', 30, 2]])
  assert.equal(s.monthly[1].winRate, 1)
  assert.equal(s.monthly.reduce((t, m) => t + m.pnl, 0), s.netPnl)
})

test('long vs short split adds up to the total', () => {
  const s = computeAnalytics([
    trade({ direction: 'long', exitPrice: 110 }),
    trade({ direction: 'short', exitPrice: 90 }),
    trade({ direction: 'short', exitPrice: 110 })
  ])
  assert.equal(s.long.count, 1)
  assert.equal(s.short.count, 2)
  assert.equal(s.long.netPnl + s.short.netPnl, s.netPnl)
  assert.equal(s.short.winRate, 0.5)
})

test('sample size bands match the backend (30 / 100)', () => {
  assert.equal(sampleLevel(0), 'none')
  assert.equal(sampleLevel(9), 'tiny')
  assert.equal(sampleLevel(29), 'early')
  assert.equal(sampleLevel(30), 'building')
  assert.equal(sampleLevel(100), 'solid')
  assert.equal(computeAnalytics(closedSet([1])).sample.reliable, false)
})

test('every metric is free and visible while enforcement is off', () => {
  for (const id of Object.keys(METRIC_ACCESS)) {
    assert.equal(METRIC_ACCESS[id], 'free', id)
    assert.equal(canViewMetric(id, 'free'), true, id)
  }
  assert.equal(canViewMetric('someFutureMetric'), true)
})
