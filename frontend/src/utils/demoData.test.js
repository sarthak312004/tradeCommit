import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  buildDemoJournal,
  buildDemoPlanEntries,
  buildDemoReviewData,
  DEMO_CARRY_FORWARD,
  DEMO_PLANNER,
  DEMO_STRATEGY_RULES,
} from '../components/demoFlywheel/demoData.js'
import { computeAnalytics, getTradePnl, isOpenTrade } from './tradeMetrics.js'

test('demoData has no imports from services, contexts, or models', () => {
  const source = fs.readFileSync(new URL('../components/demoFlywheel/demoData.js', import.meta.url), 'utf8')
  assert.equal(/from\s+['"][^'"]*(services|context|models)/i.test(source), false)
})

test('demo journal fixture has 12 normalized trades with wins, losses, 1 open, and valid Long/Short P&L signs', () => {
  const journal = buildDemoJournal(new Date('2026-11-07T12:00:00Z'))
  assert.equal(journal.name, 'Demo: Swing trades')
  assert.equal(journal.mode, 'live')
  assert.equal(journal.currency, 'USD')
  assert.ok(DEMO_STRATEGY_RULES.length >= 3 && DEMO_STRATEGY_RULES.length <= 5)

  const trades = journal.trades
  assert.equal(trades.length, 12)

  const openTrades = trades.filter((trade) => isOpenTrade(trade))
  const closedTrades = trades.filter((trade) => !isOpenTrade(trade))
  assert.equal(openTrades.length, 1)
  assert.equal(closedTrades.length, 11)
  assert.equal(getTradePnl(openTrades[0]), null)

  const analytics = computeAnalytics(trades)
  assert.equal(analytics.closedTrades, 11)
  assert.equal(analytics.openTrades, 1)
  assert.equal(analytics.incompleteTrades, 0)
  assert.ok(analytics.wins >= 1)
  assert.ok(analytics.losses >= 1)
  assert.ok(analytics.long.count >= 1)
  assert.ok(analytics.short.count >= 1)

  const longTrades = closedTrades.filter((trade) => trade.side === 'Long')
  const shortTrades = closedTrades.filter((trade) => trade.side === 'Short')
  assert.ok(longTrades.length >= 1)
  assert.ok(shortTrades.length >= 1)

  for (const trade of longTrades) {
    const rawMove = trade.exitPrice - trade.entryPrice
    if (rawMove > 0) assert.ok(getTradePnl(trade) > 0)
    if (rawMove < 0) assert.ok(getTradePnl(trade) < 0)
  }

  for (const trade of shortTrades) {
    const rawMove = trade.entryPrice - trade.exitPrice
    if (rawMove > 0) assert.ok(getTradePnl(trade) > 0)
    if (rawMove < 0) assert.ok(getTradePnl(trade) < 0)
  }
})

test('demo planner, past plan entry, and review fixture include linked journal, YYYY-MM-DD dates, and flywheel data', () => {
  const journal = buildDemoJournal(new Date('2026-11-07T12:00:00Z'))
  assert.equal(DEMO_PLANNER.linkedJournalId, journal.id)

  const entries = buildDemoPlanEntries(new Date('2026-11-07T12:00:00Z'))
  assert.equal(entries.length, 1)
  assert.equal(typeof entries[0].date, 'string')
  assert.match(entries[0].date, /^\d{4}-\d{2}-\d{2}$/)

  const reviewData = buildDemoReviewData(new Date('2026-11-07T12:00:00Z'))
  assert.equal(reviewData.review.flywheel.leaks.length, 1)
  assert.deepEqual(reviewData.review.flywheel.carryForward, DEMO_CARRY_FORWARD)
  assert.ok(reviewData.review.planAlignment.days.length >= 1)
  for (const day of reviewData.review.planAlignment.days) {
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/)
  }
})
