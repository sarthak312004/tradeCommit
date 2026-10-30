import test from 'node:test'
import assert from 'node:assert/strict'
import { getClosedRecords } from './tradeMetrics.js'
import {
  applyTradeFilters, byInstrument, bySetup, byStrategy, compareRanges, computeBreakdowns, dayOfWeek, detectFieldRoles,
  discoverFields, filterOptions, holdingDuration, longShortDetail, monthlyGrid, parseClockTime, pnlDistribution,
  previousRange, rDistribution, timeOfDay, UNTAGGED
} from './tradeBreakdowns.js'
import { computeAnalytics } from './tradeMetrics.js'

const field = (label, type, value) => ({ key: label, label, type, value })
let seq = 0
const t = (over = {}) => {
  seq += 1
  return { id: seq, assetName: 'AAPL', date: '2026-03-02', direction: 'long', quantity: 1, entryPrice: 100, exitPrice: 110, customFields: [], ...over }
}
const closed = (trades) => getClosedRecords(trades)

test('day of week reads the calendar day (no timezone shift) and hides empty weekends', () => {
  // 2026-03-02 is a Monday, 2026-03-07 a Saturday
  const rows = dayOfWeek(closed([t({ date: '2026-03-02' }), t({ date: '2026-03-02', exitPrice: 90 }), t({ date: '2026-03-04' })])).rows
  assert.deepEqual(rows.map((r) => r.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  assert.equal(rows[0].count, 2)
  assert.equal(rows[0].netPnl, 0)
  assert.equal(rows[1].count, 0)
  assert.equal(rows[1].winRate, null)
  const withSat = dayOfWeek(closed([t({ date: '2026-03-07' })])).rows
  assert.equal(withSat.at(-1).label, 'Sat')
  assert.equal(withSat.at(-1).count, 1)
})

test('day of week counts every closed trade exactly once and skips open ones', () => {
  const trades = [t({ date: '2026-03-02' }), t({ date: '2026-03-03' }), t({ date: '2026-03-09', exitPrice: undefined })]
  const result = dayOfWeek(closed(trades))
  assert.equal(result.rows.reduce((n, r) => n + r.count, 0), 2)
})

test('clock time parsing accepts common formats and rejects nonsense', () => {
  assert.equal(parseClockTime('09:30'), 570)
  assert.equal(parseClockTime('9.30'), 570)
  assert.equal(parseClockTime('0930'), 570)
  assert.equal(parseClockTime('9:30 PM'), 21 * 60 + 30)
  assert.equal(parseClockTime('12:05 am'), 5)
  assert.equal(parseClockTime('12:00 pm'), 720)
  for (const bad of ['', 'morning', '25:00', '9:75', '13:00 pm', null, undefined]) assert.equal(parseClockTime(bad), null, String(bad))
})

test('time of day: not tracked without a time property, partial coverage reported', () => {
  const none = timeOfDay(closed([t(), t()]), { entryTime: '' })
  assert.equal(none.tracked, 0)
  assert.deepEqual(none.rows, [])

  const trades = [
    t({ customFields: [field('Entry time', 'text', '09:15')] }),
    t({ customFields: [field('Entry time', 'text', '09:45'), ] , exitPrice: 90 }),
    t({ customFields: [field('Entry time', 'text', '11:10')] }),
    t({ customFields: [field('Entry time', 'text', 'around noon')] }), // unreadable
    t() // no property at all
  ]
  const res = timeOfDay(closed(trades), { entryTime: 'entry time' })
  assert.equal(res.tracked, 3)
  assert.equal(res.untracked, 2)
  assert.deepEqual(res.rows.map((r) => [r.label, r.count]), [['09:00', 2], ['10:00', 0], ['11:00', 1]])
})

test('holding duration from an exit-date property; invalid and negative dates are skipped', () => {
  const trades = [
    t({ date: '2026-03-02', customFields: [field('Exit date', 'date', '2026-03-02')] }), // same day
    t({ date: '2026-03-02', exitPrice: 90, customFields: [field('Exit date', 'date', '2026-03-05')] }), // 3 days
    t({ date: '2026-03-02', customFields: [field('Exit date', 'date', '2026-03-01')] }), // before entry: invalid
    t({ date: '2026-03-02' }) // missing
  ]
  const res = holdingDuration(closed(trades), { exitDate: 'exit date' })
  assert.equal(res.tracked, 2)
  assert.equal(res.untracked, 2)
  assert.deepEqual(res.rows.map((r) => [r.label, r.count]), [['Same day', 1], ['3-7 days', 1]])
  assert.equal(res.avgDaysWinners, 0)
  assert.equal(res.avgDaysLosers, 3)
  assert.equal(holdingDuration(closed(trades), { exitDate: '' }).tracked, 0)
})

test('field discovery and role detection', () => {
  const trades = [
    t({ customFields: [field('Strategy', 'text', 'ORB'), field('Setup', 'text', 'Breakout, Retest'), field('Entry Time', 'text', '9:30'), field('Exit Date', 'date', '2026-03-03'), field('Volume ok', 'checkbox', true)] }),
    t({ customFields: [field(' strategy ', 'text', 'VWAP')] })
  ]
  const fields = discoverFields(trades)
  assert.equal(fields.find((f) => f.id === 'strategy').filled, 2) // label match ignores case and spaces
  const roles = detectFieldRoles(fields)
  assert.deepEqual(roles, { strategy: 'strategy', setup: 'setup', entryTime: 'entry time', exitDate: 'exit date' })
  assert.deepEqual(detectFieldRoles(discoverFields([t()])), { strategy: '', setup: '', entryTime: '', exitDate: '' })
})

const tagged = () => [
  t({ assetName: 'aapl', customFields: [field('Strategy', 'text', 'ORB'), field('Setup', 'text', 'Breakout, Retest')] }),
  t({ assetName: 'AAPL', exitPrice: 90, customFields: [field('Strategy', 'text', 'ORB'), field('Setup', 'text', 'Breakout')] }),
  t({ assetName: 'TSLA', exitPrice: 130, customFields: [field('Strategy', 'text', 'VWAP')] }),
  t({ assetName: 'TSLA', direction: 'short', exitPrice: 95 })
]
const roles = { strategy: 'strategy', setup: 'setup', entryTime: '', exitDate: '' }

test('instruments are case-insensitive and sum to the total', () => {
  const res = byInstrument(closed(tagged()))
  assert.equal(res.rows.find((r) => r.key === 'AAPL').count, 2)
  assert.equal(res.rows.reduce((n, r) => n + r.count, 0), 4)
  assert.equal(res.rows.reduce((n, r) => n + r.netPnl, 0), computeAnalytics(tagged()).netPnl)
})

test('strategy groups include a No strategy row; setups split on commas and may overlap', () => {
  const trades = tagged()
  const s = byStrategy(closed(trades), roles)
  assert.deepEqual(s.rows.map((r) => [r.label, r.count]), [['ORB', 2], ['VWAP', 1], ['No strategy', 1]])
  const setups = bySetup(closed(trades), roles)
  assert.equal(setups.rows.find((r) => r.label === 'Breakout').count, 2)
  assert.equal(setups.rows.find((r) => r.label === 'Retest').count, 1)
  assert.equal(setups.rows.find((r) => r.label === 'No setup').count, 2)
  assert.equal(setups.rows.every((r) => r.lowSample), true) // all groups < 5 trades
  assert.equal(byStrategy(closed(trades), { strategy: '' }).rows.length, 0)
})

test('filters combine and use the same trades for every breakdown', () => {
  const trades = tagged()
  assert.equal(applyTradeFilters(trades, { instrument: 'AAPL' }, roles).length, 2)
  assert.equal(applyTradeFilters(trades, { instrument: 'TSLA', strategy: 'VWAP' }, roles).length, 1)
  assert.equal(applyTradeFilters(trades, { strategy: UNTAGGED }, roles).length, 1)
  assert.equal(applyTradeFilters(trades, { setup: 'retest' }, roles).length, 1)
  assert.equal(applyTradeFilters(trades, { setup: UNTAGGED }, roles).length, 2)
  assert.equal(applyTradeFilters(trades, {}, roles), trades)
  assert.deepEqual(filterOptions(trades, roles), { instruments: ['AAPL', 'TSLA'], strategies: ['ORB', 'VWAP'], setups: ['Breakout', 'Retest'] })
  // after filtering, every breakdown agrees with the overview
  const filtered = applyTradeFilters(trades, { instrument: 'AAPL' }, roles)
  const b = computeBreakdowns(filtered, roles)
  assert.equal(b.closedTrades, computeAnalytics(filtered).closedTrades)
  assert.equal(b.instruments.rows.reduce((n, r) => n + r.netPnl, 0), computeAnalytics(filtered).netPnl)
  assert.equal(b.longShort.long.netPnl + b.longShort.short.netPnl, computeAnalytics(filtered).netPnl)
})

test('long vs short detail reuses the overview maths', () => {
  const d = longShortDetail(tagged())
  assert.equal(d.long.closedTrades, 3)
  assert.equal(d.short.closedTrades, 1)
  assert.equal(d.short.netPnl, 5)
  assert.equal(d.short.profitFactor, Infinity)
})

test('monthly heatmap grid', () => {
  const s = computeAnalytics([t({ date: '2025-12-10' }), t({ date: '2026-01-05', exitPrice: 90 }), t({ date: '2026-03-02' }), t({ date: '2026-03-09' })])
  const grid = monthlyGrid(s.monthly)
  assert.deepEqual(grid.map((r) => r.year), [2025, 2026])
  assert.equal(grid[1].months[2].pnl, 20)
  assert.equal(grid[1].months[1], null)
  assert.equal(grid[1].total, 10)
  assert.deepEqual(monthlyGrid([]), [])
})

test('P&L distribution: round bins, breakeven counted but not drawn, counts add up', () => {
  const rec = closed([10, 25, 40, -10, -30, 0].map((p) => t({ exitPrice: 100 + p })))
  const d = pnlDistribution(rec)
  assert.equal(d.breakeven, 1)
  assert.equal(d.bins.reduce((n, b) => n + b.count, 0), 5)
  assert.equal(d.bins.every((b) => !(b.from < 0 && b.to > 0)), true) // no bin straddles zero
  assert.equal(d.bins.filter((b) => b.side === 'loss').reduce((n, b) => n + b.count, 0), 2)
  assert.equal(d.medianWin, 25)
  assert.equal(d.medianLoss, -20)
  assert.deepEqual(pnlDistribution([]).bins, [])
  assert.equal(pnlDistribution(closed([t({ exitPrice: 100 })])).bins.length, 0) // only breakeven
  assert.equal(pnlDistribution(closed([t({ exitPrice: 120 })])).bins.reduce((n, b) => n + b.count, 0), 1) // wins only
  assert.equal(pnlDistribution(closed([t({ exitPrice: 80 })])).bins.reduce((n, b) => n + b.count, 0), 1) // losses only
})

test('R distribution only uses trades with a stop loss', () => {
  const rec = closed([
    t({ stopLoss: 95, exitPrice: 110 }), // +2R
    t({ stopLoss: 95, exitPrice: 95 }), // -1R
    t({ stopLoss: 95, exitPrice: 130 }), // +6R -> open bucket
    t({ exitPrice: 150 }) // no stop
  ])
  const d = rDistribution(rec)
  assert.equal(d.sample, 3)
  assert.equal(d.withoutStop, 1)
  assert.equal(d.bins.reduce((n, b) => n + b.count, 0), 3)
  assert.equal(d.bins.at(-1).count, 1)
  assert.equal(d.bestR, 6)
  assert.equal(d.worstR, -1)
  assert.equal(rDistribution(closed([t()])).sample, 0)
})

test('range comparison and previous range', () => {
  assert.deepEqual(previousRange({ from: '2026-03-08', to: '2026-03-14' }), { from: '2026-03-01', to: '2026-03-07' })
  assert.deepEqual(previousRange({ from: '2026-03-01', to: '2026-03-01' }), { from: '2026-02-28', to: '2026-02-28' })
  assert.deepEqual(previousRange({ from: '', to: '' }), { from: '', to: '' })
  const trades = [t({ date: '2026-03-02' }), t({ date: '2026-03-10', exitPrice: 90 }), t({ date: '2026-03-12' })]
  const res = compareRanges(trades, { from: '2026-03-08', to: '2026-03-14' }, { from: '2026-03-01', to: '2026-03-07' })
  assert.equal(res.a.closedTrades, 2)
  assert.equal(res.b.closedTrades, 1)
  assert.equal(res.overlap, false)
  assert.equal(compareRanges(trades, { from: '2026-03-01', to: '2026-03-10' }, { from: '2026-03-05', to: '2026-03-12' }).overlap, true)
})

test('empty journal never throws', () => {
  const b = computeBreakdowns([], roles)
  assert.equal(b.closedTrades, 0)
  assert.equal(b.dayOfWeek.rows.every((r) => r.count === 0), true)
  assert.deepEqual(b.instruments.rows, [])
  assert.equal(b.rDistribution.sample, 0)
})
