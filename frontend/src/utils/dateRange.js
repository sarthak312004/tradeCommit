import { dateKeyFromDate, formatDateKey } from './tradeAnalytics'

/* Date-range presets for the trade journal filter. All keys are local YYYY-MM-DD. */

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const RANGE_PRESETS = [
  { id: 'all', label: 'All time', resolve: () => ({ from: '', to: '' }) },
  { id: 'today', label: 'Today', resolve: (now) => ({ from: dateKeyFromDate(now), to: dateKeyFromDate(now) }) },
  { id: '7d', label: 'Last 7 days', resolve: (now) => ({ from: dateKeyFromDate(addDays(now, -6)), to: dateKeyFromDate(now) }) },
  { id: '30d', label: 'Last 30 days', resolve: (now) => ({ from: dateKeyFromDate(addDays(now, -29)), to: dateKeyFromDate(now) }) },
  {
    id: 'month',
    label: 'This month',
    resolve: (now) => ({ from: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) })
  },
  {
    id: 'last-month',
    label: 'Last month',
    resolve: (now) => ({ from: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 0)) })
  },
  { id: 'year', label: 'This year', resolve: (now) => ({ from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }) }
]

export const ALL_TIME = { preset: 'all', from: '', to: '' }

export const isRangeActive = (range) => Boolean(range.from || range.to)

/** Builds a range state from a preset id. */
export const rangeFromPreset = (presetId, now = new Date()) => {
  const preset = RANGE_PRESETS.find((item) => item.id === presetId) ?? RANGE_PRESETS[0]
  return { preset: preset.id, ...preset.resolve(now) }
}

/** Short label for the filter button and sub-headings. */
export const describeRange = (range) => {
  const preset = RANGE_PRESETS.find((item) => item.id === range.preset)
  if (preset) return preset.label
  if (range.from && range.to) return `${formatDateKey(range.from)} - ${formatDateKey(range.to)}`
  if (range.from) return `From ${formatDateKey(range.from)}`
  if (range.to) return `Until ${formatDateKey(range.to)}`
  return 'All time'
}

/** Same as describeRange, but reads naturally mid-sentence ("last 7 days", "Sep 1 - Sep 14"). */
export const describeRangeInline = (range) => {
  const label = describeRange(range)
  return RANGE_PRESETS.some((item) => item.id === range.preset) ? label.toLowerCase() : label
}
