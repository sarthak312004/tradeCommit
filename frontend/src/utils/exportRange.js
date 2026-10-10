import { dateKeyFromDate } from './tradeAnalytics'

/* Date presets for exporting a journal. Keys are local YYYY-MM-DD, like the rest of the date filters. */

// n calendar months before `now`, keeping the day of month (31 Mar - 1 month = 28/29 Feb, not 3 Mar)
const monthsAgo = (now, months) => {
  const target = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(now.getDate(), lastDay))
  return target
}

const daysAgo = (now, days) => {
  const target = new Date(now)
  target.setDate(target.getDate() - days)
  return target
}

export const EXPORT_RANGES = [
  { id: '7d', label: 'Last 7 days', from: (now) => daysAgo(now, 6) },
  { id: '1m', label: 'Last month', from: (now) => monthsAgo(now, 1) },
  { id: '3m', label: 'Last 3 months', from: (now) => monthsAgo(now, 3) },
  { id: '6m', label: 'Last 6 months', from: (now) => monthsAgo(now, 6) },
  { id: '1y', label: 'Last 1 year', from: (now) => monthsAgo(now, 12) },
  { id: '2y', label: 'Last 2 years', from: (now) => monthsAgo(now, 24) },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' }
]

/** `{ from, to }` date keys for a preset ('' = no limit). `custom` uses the dates the user picked. */
export const resolveExportRange = (presetId, custom = { from: '', to: '' }, now = new Date()) => {
  if (presetId === 'custom') return { from: custom.from || '', to: custom.to || '' }
  const preset = EXPORT_RANGES.find((item) => item.id === presetId)
  if (!preset?.from) return { from: '', to: '' }
  return { from: dateKeyFromDate(preset.from(now)), to: dateKeyFromDate(now) }
}
