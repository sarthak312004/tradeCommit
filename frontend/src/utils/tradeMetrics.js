/* ------------------------------------------------------------------
 * Trade metrics: the single calculation engine behind the Analysis tab.
 *
 * Pure functions only: no React, no I/O, no imports (so it can be unit tested
 * with `node --test`). Everything is derived from the raw trade fields
 * (entry, exit, quantity, direction, stopLoss), never from a pre-formatted
 * `pnl` string, and never from hardcoded numbers.
 *
 * Conventions (they mirror the Trade model and backend/src/utils/tradeStats.js):
 *  - open trade       = no exit price. Never part of closed-trade statistics.
 *  - closed trade     = has an exit price AND entry/quantity are usable.
 *  - incomplete trade = has an exit price but P&L cannot be computed
 *                       (missing/invalid entry or quantity). Excluded and reported.
 *  - realized P&L     = (exit - entry) * quantity, sign reversed for shorts.
 *  - win / loss       = pnl > 0 / pnl < 0. Breakeven (pnl === 0) is neither,
 *                       but still counts as a closed trade (win rate denominator)
 *                       and breaks win/loss streaks.
 *  - R multiple       = pnl / (|entry - stop| * quantity); needs a stop loss.
 *  - Live and backtest journals are separate journals, so callers pass one
 *    journal's (already date-filtered) trades. This module never mixes them.
 * ------------------------------------------------------------------ */

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const isShort = (trade) => String(trade.direction ?? trade.side ?? '').toLowerCase() === 'short'

/** True when the trade has no exit price yet (the Trade model's definition of "open"). */
export const isOpenTrade = (trade) => toNumber(trade.exitPrice ?? trade.exit) === null

/** Realised P&L in currency units. `null` while the trade is open or cannot be computed. */
export const getTradePnl = (trade) => {
  const entry = toNumber(trade.entryPrice ?? trade.entry)
  const exit = toNumber(trade.exitPrice ?? trade.exit)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  if (entry === null || exit === null || quantity === null) return null
  return (exit - entry) * (isShort(trade) ? -1 : 1) * quantity
}

/** Initial risk in currency units (|entry - stop| * quantity). `null` without a usable stop loss. */
export const getTradeRisk = (trade) => {
  const entry = toNumber(trade.entryPrice ?? trade.entry)
  const stop = toNumber(trade.stopLoss)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  if (entry === null || stop === null || quantity === null) return null
  const risk = Math.abs(entry - stop) * quantity
  return risk > 0 ? risk : null
}

/**
 * Realised R multiple = pnl / initial risk.
 * Needs a stop loss; returns `null` when it is missing or equals the entry.
 */
export const getTradeR = (trade) => {
  const pnl = getTradePnl(trade)
  const risk = getTradeRisk(trade)
  return pnl === null || risk === null ? null : pnl / risk
}

/* ---------------------------- dates ---------------------------- */

const pad = (value) => String(value).padStart(2, '0')

/** Local calendar day as YYYY-MM-DD. */
export const dateKeyFromDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Normalises whatever the trade holds as `date` to YYYY-MM-DD, or `null`. */
export const toDateKey = (value) => {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : dateKeyFromDate(parsed)
}

/* --------------------------- helpers --------------------------- */

const sum = (values) => values.reduce((total, value) => total + value, 0)

const mean = (values) => (values.length ? sum(values) / values.length : null)

// population standard deviation
const stdDev = (values) => {
  if (values.length < 2) return null
  const average = mean(values)
  return Math.sqrt(sum(values.map((value) => (value - average) ** 2)) / values.length)
}

// longest consecutive run of `true` flags
const longestRun = (flags) => {
  let best = 0
  let current = 0
  for (const flag of flags) {
    current = flag ? current + 1 : 0
    if (current > best) best = current
  }
  return best
}

// the streak the trader is on right now (last closed trade backwards)
const currentRun = (pnls) => {
  if (!pnls.length) return { type: null, length: 0 }
  const last = pnls[pnls.length - 1]
  const type = last > 0 ? 'win' : last < 0 ? 'loss' : null
  if (!type) return { type: null, length: 0 }
  let length = 0
  for (let i = pnls.length - 1; i >= 0; i -= 1) {
    if ((type === 'win' && pnls[i] > 0) || (type === 'loss' && pnls[i] < 0)) length += 1
    else break
  }
  return { type, length }
}

/* ------------------------ sample size -------------------------- */

// Same bands as backend sampleStrength (<30 early, <100 building, otherwise solid), plus a "tiny" band.
export const SAMPLE_THRESHOLDS = { tiny: 10, early: 30, building: 100 }

/** How much weight a closed-trade count can carry: 'none' | 'tiny' | 'early' | 'building' | 'solid'. */
export const sampleLevel = (closedCount) => {
  if (!closedCount) return 'none'
  if (closedCount < SAMPLE_THRESHOLDS.tiny) return 'tiny'
  if (closedCount < SAMPLE_THRESHOLDS.early) return 'early'
  if (closedCount < SAMPLE_THRESHOLDS.building) return 'building'
  return 'solid'
}

/** Minimum closed trades before a ratio metric stops being flagged as a small sample. */
export const MIN_RELIABLE_SAMPLE = SAMPLE_THRESHOLDS.early

/* ---------------------- risk consistency ----------------------- */

const MIN_RISK_SAMPLE = 5

/**
 * How steady the trader's per-trade risk is, from trades that logged a stop loss.
 * `cv` (coefficient of variation) = std dev of risk / average risk, unit-free:
 * ~0 means every trade risked the same amount; high means risk is all over the place.
 */
export const computeRiskConsistency = (closed) => {
  const risks = closed.map((item) => item.risk).filter((value) => value !== null)
  const base = {
    closedTrades: closed.length,
    withStop: risks.length,
    stopCoverage: closed.length ? risks.length / closed.length : null,
    avgRisk: mean(risks),
    maxRisk: risks.length ? Math.max(...risks) : null,
    minRisk: risks.length ? Math.min(...risks) : null,
    cv: null,
    maxToAvg: null,
    level: null // 'consistent' | 'moderate' | 'varied', only with enough trades
  }
  if (risks.length < MIN_RISK_SAMPLE) return base
  const average = base.avgRisk
  const spread = stdDev(risks)
  const cv = average > 0 && spread !== null ? spread / average : null
  return {
    ...base,
    cv,
    maxToAvg: average > 0 ? base.maxRisk / average : null,
    level: cv === null ? null : cv < 0.25 ? 'consistent' : cv < 0.6 ? 'moderate' : 'varied'
  }
}

/* --------------------------- monthly --------------------------- */

const computeMonthly = (closed) => {
  const months = new Map()
  for (const item of closed) {
    if (!item.dateKey) continue
    const key = item.dateKey.slice(0, 7)
    const bucket = months.get(key) ?? { month: key, pnl: 0, trades: 0, wins: 0, losses: 0 }
    bucket.pnl += item.pnl
    bucket.trades += 1
    if (item.pnl > 0) bucket.wins += 1
    if (item.pnl < 0) bucket.losses += 1
    months.set(key, bucket)
  }
  return [...months.values()]
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map((bucket) => ({ ...bucket, winRate: bucket.trades ? bucket.wins / bucket.trades : null }))
}

/* --------------------------- summaries -------------------------- */

const summarise = (closed) => {
  const pnls = closed.map((item) => item.pnl)
  const wins = pnls.filter((value) => value > 0)
  const losses = pnls.filter((value) => value < 0)
  const grossLoss = Math.abs(sum(losses))
  return {
    count: closed.length,
    wins: wins.length,
    losses: losses.length,
    netPnl: sum(pnls),
    avgPnl: closed.length ? sum(pnls) / closed.length : null,
    winRate: closed.length ? wins.length / closed.length : null,
    profitFactor: grossLoss > 0 ? sum(wins) / grossLoss : sum(wins) > 0 ? Infinity : null
  }
}

/**
 * Everything the analysis tab needs, derived from a list of trades.
 * Only closed trades (an exit price and a computable P&L) count towards P&L metrics.
 */
export const computeAnalytics = (trades) => {
  const list = Array.isArray(trades) ? trades.filter(Boolean) : []

  const closed = list
    .map((trade, index) => ({
      trade,
      index,
      pnl: getTradePnl(trade),
      r: getTradeR(trade),
      risk: getTradeRisk(trade),
      dateKey: toDateKey(trade.date) ?? ''
    }))
    .filter((item) => item.pnl !== null)
    // Date is day-only; use creation time to order trades made on the same day.
    .sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1
      const aCreatedAt = Date.parse(a.trade.createdAt ?? '')
      const bCreatedAt = Date.parse(b.trade.createdAt ?? '')
      if (Number.isFinite(aCreatedAt) && Number.isFinite(bCreatedAt) && aCreatedAt !== bCreatedAt) {
        return aCreatedAt - bCreatedAt
      }
      return a.index - b.index
    })

  const openTrades = list.filter(isOpenTrade).length
  // has an exit price but entry/quantity are unusable, so no P&L can be trusted
  const incompleteTrades = list.length - closed.length - openTrades

  const pnls = closed.map((item) => item.pnl)
  const wins = pnls.filter((value) => value > 0)
  const losses = pnls.filter((value) => value < 0)
  const grossProfit = sum(wins)
  const grossLoss = Math.abs(sum(losses))
  const netPnl = sum(pnls)

  // equity curve, anchored at 0 before the first closed trade
  let running = 0
  let peak = 0
  let maxDrawdown = 0
  const equity = [{ index: 0, value: 0, label: 'Start', trade: null }]
  closed.forEach((item, position) => {
    running += item.pnl
    peak = Math.max(peak, running)
    maxDrawdown = Math.max(maxDrawdown, peak - running)
    equity.push({ index: position + 1, value: running, label: item.dateKey, trade: item.trade, pnl: item.pnl })
  })
  const currentDrawdown = Math.max(0, peak - running)

  const rValues = closed.map((item) => item.r).filter((value) => value !== null)
  const winR = closed.filter((item) => item.pnl > 0 && item.r !== null).map((item) => item.r)
  const lossR = closed.filter((item) => item.pnl < 0 && item.r !== null).map((item) => item.r)
  const avgWinR = winR.length ? sum(winR) / winR.length : null
  const avgLossR = lossR.length ? Math.abs(sum(lossR) / lossR.length) : null // shown as a positive size
  const avgR = rValues.length ? sum(rValues) / rValues.length : null
  const avgWin = wins.length ? grossProfit / wins.length : null
  const avgLoss = losses.length ? grossLoss / losses.length : null

  const bySide = (side) => summarise(closed.filter((item) => (isShort(item.trade) ? 'short' : 'long') === side))

  return {
    totalTrades: list.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevenTrades: closed.length - wins.length - losses.length,
    openTrades,
    incompleteTrades,
    netPnl,
    grossProfit,
    grossLoss,
    winRate: closed.length ? wins.length / closed.length : null,
    expectancy: closed.length ? netPnl / closed.length : null,
    // Infinity = profitable with zero losing trades; null = nothing won or lost yet.
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    // Average R per trade is the EXPECTANCY in R. It is not a reward-to-risk ratio.
    avgR,
    expectancyR: avgR,
    avgRrr: avgR, // legacy name, same value
    rSample: rValues.length,
    rrrSample: rValues.length,
    avgWinR,
    avgLossR,
    // Reward-to-risk = average winner / average loser, both in R (needs stops on those trades)
    rewardRisk: avgWinR !== null && avgLossR !== null && avgLossR > 0 ? avgWinR / avgLossR : null,
    avgWin,
    avgLoss,
    payoffRatio: avgWin !== null && avgLoss !== null ? avgWin / avgLoss : null,
    bestTrade: closed.length ? Math.max(...pnls) : null,
    worstTrade: closed.length ? Math.min(...pnls) : null,
    maxDrawdown,
    currentDrawdown,
    // Net P&L per unit of worst drawdown. Undefined without a drawdown, so null (not Infinity).
    recoveryFactor: maxDrawdown > 0 ? netPnl / maxDrawdown : null,
    winStreak: longestRun(pnls.map((value) => value > 0)),
    lossStreak: longestRun(pnls.map((value) => value < 0)),
    currentStreak: currentRun(pnls),
    riskConsistency: computeRiskConsistency(closed),
    monthly: computeMonthly(closed),
    sample: { closed: closed.length, level: sampleLevel(closed.length), reliable: closed.length >= MIN_RELIABLE_SAMPLE },
    long: bySide('long'),
    short: bySide('short'),
    equity
  }
}
