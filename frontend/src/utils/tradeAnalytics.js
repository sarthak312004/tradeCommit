import { DEFAULT_CURRENCY, localeForCurrency } from './currencies'

/* ------------------------------------------------------------------
 * Trade analytics helpers
 * Pure functions only: no React, no I/O. Everything is derived from the
 * raw trade fields (entry, exit, quantity, direction, stopLoss) so the
 * numbers never depend on the pre-formatted `pnl` string from the API.
 * ------------------------------------------------------------------ */

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const isShort = (trade) => String(trade.direction ?? trade.side ?? '').toLowerCase() === 'short'

/** Realised P&L in currency units. `null` while the trade is still open. */
export const getTradePnl = (trade) => {
  const entry = toNumber(trade.entryPrice ?? trade.entry)
  const exit = toNumber(trade.exitPrice ?? trade.exit)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  if (entry === null || exit === null || quantity === null) return null
  return (exit - entry) * (isShort(trade) ? -1 : 1) * quantity
}

/**
 * Realised reward-to-risk (R multiple) = pnl / initial risk.
 * Needs a stop loss; returns `null` when it is missing or equals the entry.
 */
export const getTradeR = (trade) => {
  const pnl = getTradePnl(trade)
  const entry = toNumber(trade.entryPrice ?? trade.entry)
  const stop = toNumber(trade.stopLoss)
  const quantity = toNumber(trade.quantity ?? trade.qty)
  if (pnl === null || entry === null || stop === null || quantity === null) return null
  const risk = Math.abs(entry - stop) * quantity
  return risk > 0 ? pnl / risk : null
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

/** Keeps trades whose date falls inside [from, to] (both inclusive, both optional). */
export const filterTradesByDate = (trades, { from = '', to = '' } = {}) => {
  if (!from && !to) return trades
  return trades.filter((trade) => {
    const key = toDateKey(trade.date)
    if (!key) return false
    if (from && key < from) return false
    if (to && key > to) return false
    return true
  })
}

// Newest first: by trade date, then by when it was logged (two trades on the same day show the latest on top).
export const sortTradesNewestFirst = (trades) =>
  [...trades].sort((a, b) => {
    const byDate = String(toDateKey(b.date) ?? '').localeCompare(String(toDateKey(a.date) ?? ''))
    return byDate || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  })

/* --------------------------- analytics -------------------------- */

const sum = (values) => values.reduce((total, value) => total + value, 0)

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

const summarise = (closed) => {
  const pnls = closed.map((item) => item.pnl)
  const wins = pnls.filter((value) => value > 0)
  return {
    count: closed.length,
    netPnl: sum(pnls),
    winRate: closed.length ? wins.length / closed.length : null
  }
}

/**
 * Everything the analysis tab needs, derived from a list of trades.
 * Only closed trades (those with an exit price) count towards P&L metrics.
 */
export const computeAnalytics = (trades) => {
  const closed = trades
    .map((trade, index) => ({
      trade,
      index,
      pnl: getTradePnl(trade),
      r: getTradeR(trade),
      dateKey: toDateKey(trade.date) ?? ''
    }))
    .filter((item) => item.pnl !== null)
    // chronological; ties keep the order the trades were logged in
    .sort((a, b) => (a.dateKey === b.dateKey ? a.index - b.index : a.dateKey < b.dateKey ? -1 : 1))

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

  const rValues = closed.map((item) => item.r).filter((value) => value !== null)
  const avgWin = wins.length ? grossProfit / wins.length : null
  const avgLoss = losses.length ? grossLoss / losses.length : null

  const bySide = (side) => summarise(closed.filter((item) => (isShort(item.trade) ? 'short' : 'long') === side))

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    openTrades: trades.length - closed.length,
    netPnl,
    winRate: closed.length ? wins.length / closed.length : null,
    expectancy: closed.length ? netPnl / closed.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    avgRrr: rValues.length ? sum(rValues) / rValues.length : null,
    rrrSample: rValues.length,
    avgWin,
    avgLoss,
    payoffRatio: avgWin !== null && avgLoss !== null ? avgWin / avgLoss : null,
    bestTrade: closed.length ? Math.max(...pnls) : null,
    worstTrade: closed.length ? Math.min(...pnls) : null,
    maxDrawdown,
    winStreak: longestRun(pnls.map((value) => value > 0)),
    lossStreak: longestRun(pnls.map((value) => value < 0)),
    long: bySide('long'),
    short: bySide('short'),
    equity
  }
}

/* -------------------------- formatting -------------------------- */

const formatters = new Map()

const getFormatter = (currency, compact) => {
  const key = `${currency}:${compact}`
  if (!formatters.has(key)) {
    // currency decides the decimals (USD 2, JPY 0) and the locale decides the digit grouping
    formatters.set(key, new Intl.NumberFormat(localeForCurrency(currency), {
      style: 'currency',
      currency,
      ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {})
    }))
  }
  return formatters.get(key)
}

/**
 * $1,234.50 / -$80.00 / ₹1,25,000.00 depending on the journal's currency.
 * Pass `signed` to prefix gains with "+", `compact` for axis labels.
 */
export const formatMoney = (value, { signed = false, compact = false, currency = DEFAULT_CURRENCY } = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  const text = getFormatter(currency, compact).format(Math.abs(value))
  // an amount that rounds to zero is shown without a sign
  if (value < 0 && /[1-9]/.test(text)) return `-${text}`
  return signed && value > 0 ? `+${text}` : text
}

export const formatPercent = (value) => (value === null || value === undefined ? '-' : `${Math.round(value * 100)}%`)

export const formatRatio = (value) => {
  if (value === null || value === undefined) return '-'
  if (value === Infinity) return '∞'
  return value.toFixed(2)
}

export const formatR = (value) => {
  if (value === null || value === undefined) return '-'
  return `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}R`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-14" -> "Sep 14" (adds the year when it is not the current one, or when asked). */
export const formatDateKey = (key, { withYear = false } = {}) => {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || ''
  const [year, month, day] = key.split('-').map(Number)
  const showYear = withYear || year !== new Date().getFullYear()
  return `${MONTHS[month - 1]} ${day}${showYear ? `, ${year}` : ''}`
}

/** Sign-aware tone name used for colouring: 'positive' | 'negative' | 'neutral'. */
export const toneOf = (value) => (value === null || value === undefined || Math.abs(value) < 0.005 ? 'neutral' : value > 0 ? 'positive' : 'negative')
