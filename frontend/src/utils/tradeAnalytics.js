import { DEFAULT_CURRENCY, localeForCurrency } from './currencies'
import { toDateKey } from './tradeMetrics'

/* ------------------------------------------------------------------
 * Trade analytics helpers.
 * The calculation engine lives in ./tradeMetrics.js (pure, unit tested). It is re-exported
 * here so existing imports keep working. This file adds list helpers and number formatting.
 * ------------------------------------------------------------------ */

export {
  computeAnalytics,
  dateKeyFromDate,
  getTradePnl,
  getTradeR,
  getTradeRisk,
  isOpenTrade,
  sampleLevel,
  toDateKey,
  MIN_RELIABLE_SAMPLE
} from './tradeMetrics'

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
  // an amount that rounds to zero is shown without a sign (either way: no "-$0.00" and no "+$0.00")
  const isZeroText = !/[1-9]/.test(text)
  if (value < 0 && !isZeroText) return `-${text}`
  return signed && value > 0 && !isZeroText ? `+${text}` : text
}

export const formatPercent = (value) => {
  if (value === null || value === undefined) return '-'
  const rounded = Math.round(value * 100)
  // 99.6% must not read as 100% (and 0.4% not as 0%) while there are still losses (or wins)
  if (value < 1 && rounded >= 100) return '99%'
  if (value > 0 && rounded <= 0) return '1%'
  return `${rounded}%`
}

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
