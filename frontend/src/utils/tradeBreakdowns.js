/* ------------------------------------------------------------------
 * Performance breakdowns: day of week, time of day, holding time, instruments,
 * strategies, setups/tags, long vs short, distributions, range comparison.
 *
 * Pure functions on top of tradeMetrics.js. They only ever see the trades the caller
 * hands in (one journal, already live-or-backtest by construction), so every chart
 * and metric on the dashboard responds to the same filters.
 *
 * Data reality: the Trade model stores a date (no clock time) and no exit date.
 * Time of day and holding time are therefore read from the journal's own custom
 * properties (a text "Entry time" property, a date "Exit date" property) when the
 * user has them, and reported as "not tracked" otherwise. Nothing is guessed.
 * ------------------------------------------------------------------ */
import { computeAnalytics, getClosedRecords, summariseClosed, toDateKey } from './tradeMetrics.js'

export const MIN_GROUP_SAMPLE = 5 // a group below this many closed trades is flagged "low sample"
export const UNTAGGED = '__none__'
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const norm = (value) => String(value ?? '').trim()
const normKey = (value) => norm(value).toLowerCase()

const withSample = (summary) => ({ ...summary, lowSample: summary.count < MIN_GROUP_SAMPLE })

/* --------------------------- date keys -------------------------- */

const parseKey = (key) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '')
  if (!match) return null
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(time) ? null : time
}

const DAY_MS = 86400000

export const diffDays = (fromKey, toKey) => {
  const from = parseKey(fromKey)
  const to = parseKey(toKey)
  return from === null || to === null ? null : Math.round((to - from) / DAY_MS)
}

export const addDaysToKey = (key, days) => {
  const time = parseKey(key)
  return time === null ? null : new Date(time + days * DAY_MS).toISOString().slice(0, 10)
}

const weekdayIndex = (key) => {
  const time = parseKey(key)
  return time === null ? null : (new Date(time).getUTCDay() + 6) % 7 // Monday = 0
}

/* ---------------------- custom-field access --------------------- */

/** Stable identity for a user-defined property: its label, case/space-insensitive. */
export const fieldId = (label) => normKey(label)

export const getFieldValue = (trade, id) => {
  const field = (trade?.customFields ?? []).find((item) => fieldId(item?.label) === id)
  return field ? field.value : undefined
}

const isFilled = (value) => value !== undefined && value !== null && value !== '' && value !== false

/** Every property used on these trades: [{ id, label, type, filled }], most used first. */
export const discoverFields = (trades) => {
  const found = new Map()
  for (const trade of trades ?? []) {
    for (const field of trade?.customFields ?? []) {
      const id = fieldId(field?.label)
      if (!id) continue
      const entry = found.get(id) ?? { id, label: norm(field.label), type: field.type, filled: 0 }
      if (isFilled(field.value)) entry.filled += 1
      found.set(id, entry)
    }
  }
  return [...found.values()].sort((a, b) => b.filled - a.filled || a.label.localeCompare(b.label))
}

const pick = (fields, type, pattern, exclude) =>
  fields.find((field) => field.type === type && field.filled > 0 && pattern.test(field.label) && !(exclude && exclude.test(field.label)))?.id ?? ''

/** Best-guess property for each role from labels; users can override every one in the UI. */
export const detectFieldRoles = (fields) => ({
  strategy: pick(fields, 'text', /strateg/i),
  setup: pick(fields, 'text', /setup|pattern|tags?\b|trigger/i),
  entryTime: pick(fields, 'text', /time/i, /exit|close|hold|duration/i),
  exitDate: pick(fields, 'date', /exit|close|sell|cover/i)
})

export const ROLE_FIELD_TYPE = { strategy: 'text', setup: 'text', entryTime: 'text', exitDate: 'date' }

const splitTags = (value) =>
  norm(value)
    .split(/[,;|]/)
    .map(norm)
    .filter(Boolean)

/* ------------------------------ filters ------------------------- */

const instrumentOf = (trade) => norm(trade.assetName ?? trade.symbol).toUpperCase()

const strategyOf = (trade, roles) => (roles.strategy ? norm(getFieldValue(trade, roles.strategy)) : '')

const setupsOf = (trade, roles) => (roles.setup ? splitTags(getFieldValue(trade, roles.setup)) : [])

/** Options for the instrument / strategy / setup filters, from the trades in this journal. */
export const filterOptions = (trades, roles) => {
  const instruments = new Set()
  const strategies = new Set()
  const setups = new Set()
  for (const trade of trades ?? []) {
    const instrument = instrumentOf(trade)
    if (instrument) instruments.add(instrument)
    const strategy = strategyOf(trade, roles)
    if (strategy) strategies.add(strategy)
    for (const setup of setupsOf(trade, roles)) setups.add(setup)
  }
  const sorted = (set) => [...set].sort((a, b) => a.localeCompare(b))
  return { instruments: sorted(instruments), strategies: sorted(strategies), setups: sorted(setups) }
}

/** Keeps trades matching every active filter ('' = no filter, UNTAGGED = trades with no value). */
export const applyTradeFilters = (trades, filters = {}, roles = {}) => {
  const { instrument = '', strategy = '', setup = '' } = filters
  if (!instrument && !strategy && !setup) return trades
  return trades.filter((trade) => {
    if (instrument && instrumentOf(trade) !== instrument) return false
    if (strategy) {
      const value = strategyOf(trade, roles)
      if (strategy === UNTAGGED ? value !== '' : normKey(value) !== normKey(strategy)) return false
    }
    if (setup) {
      const tags = setupsOf(trade, roles)
      if (setup === UNTAGGED ? tags.length !== 0 : !tags.some((tag) => normKey(tag) === normKey(setup))) return false
    }
    return true
  })
}

/* --------------------------- grouping --------------------------- */

const summariseGroups = (closed, keysOf) => {
  const groups = new Map()
  let untracked = 0
  for (const record of closed) {
    const keys = keysOf(record)
    if (!keys || keys.length === 0) {
      untracked += 1
      continue
    }
    for (const key of new Set(keys)) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(record)
    }
  }
  return { groups, untracked }
}

const rowsFrom = (groups, labelOf = (key) => key) =>
  [...groups.entries()].map(([key, items]) => ({ key, label: labelOf(key), ...withSample(summariseClosed(items)) }))

// biggest groups first, then best P&L; "no value" rows sink to the bottom
const byImportance = (a, b) => (a.key === UNTAGGED) - (b.key === UNTAGGED) || b.count - a.count || b.netPnl - a.netPnl

const MAX_ROWS = 12

const finishCategorical = (rows, untracked, total) => {
  const sorted = rows.sort(byImportance)
  return { rows: sorted.slice(0, MAX_ROWS), hidden: Math.max(0, sorted.length - MAX_ROWS), untracked, total }
}

/* ----------------------- day of week / month -------------------- */

/** Mon..Fri always; Sat/Sun only when something was traded then. Dates are read as calendar days (no timezone shift). */
export const dayOfWeek = (closed) => {
  const { groups, untracked } = summariseGroups(closed, (record) => {
    const index = weekdayIndex(record.dateKey)
    return index === null ? null : [index]
  })
  const rows = WEEKDAYS.map((label, index) => ({
    key: index,
    label,
    ...withSample(summariseClosed(groups.get(index) ?? []))
  })).filter((row) => row.key < 5 || row.count > 0)
  return { rows, untracked, total: closed.length }
}

/** Year x month grid of net P&L, from the `monthly` array computeAnalytics already builds. */
export const monthlyGrid = (monthly) => {
  const years = new Map()
  for (const entry of monthly ?? []) {
    const [year, month] = entry.month.split('-').map(Number)
    if (!years.has(year)) years.set(year, { year, months: Array(12).fill(null), total: 0, trades: 0 })
    const row = years.get(year)
    row.months[month - 1] = { pnl: entry.pnl, trades: entry.trades, winRate: entry.winRate }
    row.total += entry.pnl
    row.trades += entry.trades
  }
  return [...years.values()].sort((a, b) => a.year - b.year)
}

/* ------------------------- time and holding --------------------- */

/** "09:30", "9.30", "9:30 PM", "0930" -> minutes since midnight, or null when it is not a clock time. */
export const parseClockTime = (value) => {
  const text = norm(value).toLowerCase()
  if (!text) return null
  let match = /^(\d{1,2})[:.h](\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(text)
  if (!match) match = /^(\d{2})(\d{2})\s*(am|pm)?$/.exec(text)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]
  if (minutes > 59) return null
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    hours = (hours % 12) + (meridiem === 'pm' ? 12 : 0)
  }
  return hours > 23 ? null : hours * 60 + minutes
}

const hourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`

/** Performance by hour of entry. Needs a text "time" property; without it `tracked` is 0 and `rows` is empty. */
export const timeOfDay = (closed, roles) => {
  const minutesOf = (record) => (roles.entryTime ? parseClockTime(getFieldValue(record.trade, roles.entryTime)) : null)
  const { groups, untracked } = summariseGroups(closed, (record) => {
    const minutes = minutesOf(record)
    return minutes === null ? null : [Math.floor(minutes / 60)]
  })
  const hours = [...groups.keys()]
  if (!hours.length) return { rows: [], tracked: 0, untracked, total: closed.length }
  const first = Math.min(...hours)
  const last = Math.max(...hours)
  const rows = []
  for (let hour = first; hour <= last; hour += 1) {
    rows.push({ key: hour, label: hourLabel(hour), ...withSample(summariseClosed(groups.get(hour) ?? [])) })
  }
  return { rows, tracked: closed.length - untracked, untracked, total: closed.length }
}

export const HOLDING_BUCKETS = [
  { id: 'same-day', label: 'Same day', test: (days) => days === 0 },
  { id: '1-2', label: '1-2 days', test: (days) => days >= 1 && days <= 2 },
  { id: '3-7', label: '3-7 days', test: (days) => days >= 3 && days <= 7 },
  { id: '8-30', label: '8-30 days', test: (days) => days >= 8 && days <= 30 },
  { id: '31+', label: '31+ days', test: (days) => days >= 31 }
]

/** Holding time in whole days = exit-date property minus trade date. Negative or unreadable dates are skipped. */
export const holdingDuration = (closed, roles) => {
  const daysOf = (record) => {
    if (!roles.exitDate) return null
    const days = diffDays(record.dateKey, toDateKey(getFieldValue(record.trade, roles.exitDate)))
    return days === null || days < 0 ? null : days
  }
  const tracked = []
  for (const record of closed) {
    const days = daysOf(record)
    if (days !== null) tracked.push({ record, days })
  }
  const rows = HOLDING_BUCKETS.map((bucket) => ({
    key: bucket.id,
    label: bucket.label,
    ...withSample(summariseClosed(tracked.filter((item) => bucket.test(item.days)).map((item) => item.record)))
  })).filter((row) => row.count > 0)
  const average = (items) => (items.length ? items.reduce((total, item) => total + item.days, 0) / items.length : null)
  return {
    rows,
    tracked: tracked.length,
    untracked: closed.length - tracked.length,
    total: closed.length,
    avgDaysWinners: average(tracked.filter((item) => item.record.pnl > 0)),
    avgDaysLosers: average(tracked.filter((item) => item.record.pnl < 0))
  }
}

/* --------------- instruments, strategies, setups ---------------- */

export const byInstrument = (closed) => {
  const { groups, untracked } = summariseGroups(closed, (record) => {
    const instrument = instrumentOf(record.trade)
    return instrument ? [instrument] : null
  })
  return finishCategorical(rowsFrom(groups), untracked, closed.length)
}

/** Strategy comparison from the chosen strategy property. Trades without a value form one "No strategy" row. */
export const byStrategy = (closed, roles) => {
  if (!roles.strategy) return { rows: [], hidden: 0, untracked: closed.length, total: closed.length, field: '' }
  const { groups } = summariseGroups(closed, (record) => [strategyOf(record.trade, roles) || UNTAGGED])
  const result = finishCategorical(rowsFrom(groups, (key) => (key === UNTAGGED ? 'No strategy' : key)), 0, closed.length)
  return { ...result, field: roles.strategy }
}

/** Setup / tag comparison. Comma-separated values count in each of their groups, so groups can overlap. */
export const bySetup = (closed, roles) => {
  if (!roles.setup) return { rows: [], hidden: 0, untracked: closed.length, total: closed.length, field: '' }
  const { groups } = summariseGroups(closed, (record) => {
    const tags = setupsOf(record.trade, roles)
    return tags.length ? tags : [UNTAGGED]
  })
  const result = finishCategorical(rowsFrom(groups, (key) => (key === UNTAGGED ? 'No setup' : key)), 0, closed.length)
  return { ...result, field: roles.setup }
}

/* ----------------------------- long / short --------------------- */

/** Full analytics for each side, so the detail table reuses exactly the same maths as the overview. */
export const longShortDetail = (trades) => {
  const side = (name) => computeAnalytics(trades.filter((trade) => (String(trade.direction ?? trade.side ?? '').toLowerCase() === 'short' ? 'short' : 'long') === name))
  return { long: side('long'), short: side('short') }
}

/* --------------------------- distributions ---------------------- */

const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// 1, 2, 2.5, 5 x 10^n: the next "round" bin width at or above `raw`
const niceStep = (raw) => {
  if (!(raw > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power
}

const roundTo = (value) => Number(value.toPrecision(12))

/**
 * Histogram of realised P&L per trade. Breakeven trades (exactly 0) are not drawn, only counted,
 * because a zero belongs to neither side. Bin edges are round numbers that never straddle zero.
 */
export const pnlDistribution = (closed) => {
  const pnls = closed.map((record) => record.pnl)
  const wins = pnls.filter((value) => value > 0)
  const losses = pnls.filter((value) => value < 0)
  const breakeven = pnls.length - wins.length - losses.length
  const base = { breakeven, wins: wins.length, losses: losses.length, medianWin: median(wins), medianLoss: median(losses), bins: [], step: null }
  if (!wins.length && !losses.length) return base
  const extent = Math.max(...pnls.map(Math.abs))
  const step = niceStep(extent / 5)
  const lowest = Math.floor(Math.min(...losses, 0) / step)
  const highest = Math.ceil(Math.max(...wins, 0) / step)
  const bins = []
  for (let index = lowest; index < highest; index += 1) {
    const from = roundTo(index * step)
    const to = roundTo((index + 1) * step)
    const count = pnls.filter((value) => value !== 0 && value >= from && (value < to || (index === highest - 1 && value === to))).length
    bins.push({ from, to, count, side: to <= 0 ? 'loss' : 'win' })
  }
  return { ...base, bins, step }
}

export const R_EDGES = [-3, -2, -1, 0, 1, 2, 3, 4]

/** Histogram of R multiples in 1R buckets with open-ended outer buckets. Only trades that logged a stop loss. */
export const rDistribution = (closed) => {
  const rs = closed.filter((record) => record.r !== null && record.pnl !== 0).map((record) => record.r)
  const bins = []
  const lastEdge = R_EDGES[R_EDGES.length - 1]
  bins.push({ from: null, to: R_EDGES[0], label: `≤ ${R_EDGES[0]}R`, count: rs.filter((value) => value < R_EDGES[0]).length, side: 'loss' })
  for (let index = 0; index < R_EDGES.length - 1; index += 1) {
    const from = R_EDGES[index]
    const to = R_EDGES[index + 1]
    bins.push({ from, to, label: `${from} to ${to}R`, count: rs.filter((value) => value >= from && value < to).length, side: to <= 0 ? 'loss' : 'win' })
  }
  bins.push({ from: lastEdge, to: null, label: `≥ ${lastEdge}R`, count: rs.filter((value) => value >= lastEdge).length, side: 'win' })
  const all = closed.filter((record) => record.r !== null)
  return {
    bins,
    sample: all.length,
    withoutStop: closed.length - all.length,
    medianR: median(all.map((record) => record.r)),
    avgR: all.length ? all.reduce((total, record) => total + record.r, 0) / all.length : null,
    bestR: all.length ? Math.max(...all.map((record) => record.r)) : null,
    worstR: all.length ? Math.min(...all.map((record) => record.r)) : null
  }
}

/* --------------------------- range comparison ------------------- */

export const isValidRange = (range) => Boolean(range?.from && range?.to && parseKey(range.from) !== null && parseKey(range.to) !== null && range.from <= range.to)

/** The range of identical length that ends the day before `range` starts. */
export const previousRange = (range) => {
  if (!isValidRange(range)) return { from: '', to: '' }
  const length = diffDays(range.from, range.to) + 1
  const to = addDaysToKey(range.from, -1)
  return { from: addDaysToKey(to, -(length - 1)), to }
}

export const rangesOverlap = (a, b) => isValidRange(a) && isValidRange(b) && a.from <= b.to && b.from <= a.to

const inRange = (trade, range) => {
  const key = toDateKey(trade.date)
  return Boolean(key) && key >= range.from && key <= range.to
}

/** Full analytics for two date ranges over the same (already filtered) trades. */
export const compareRanges = (trades, rangeA, rangeB) => ({
  a: computeAnalytics(trades.filter((trade) => inRange(trade, rangeA))),
  b: computeAnalytics(trades.filter((trade) => inRange(trade, rangeB))),
  overlap: rangesOverlap(rangeA, rangeB)
})

/** One call that produces every breakdown for the dashboard, from a single pass over the closed trades. */
export const computeBreakdowns = (trades, roles) => {
  const closed = getClosedRecords(trades)
  return {
    closedTrades: closed.length,
    dayOfWeek: dayOfWeek(closed),
    timeOfDay: timeOfDay(closed, roles),
    holding: holdingDuration(closed, roles),
    instruments: byInstrument(closed),
    strategies: byStrategy(closed, roles),
    setups: bySetup(closed, roles),
    longShort: longShortDetail(trades),
    pnlDistribution: pnlDistribution(closed),
    rDistribution: rDistribution(closed)
  }
}
