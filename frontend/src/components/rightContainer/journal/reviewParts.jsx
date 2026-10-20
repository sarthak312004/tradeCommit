import { useState } from 'react'
import { ChevronDownIcon } from '../../../utils/Icons.jsx'
import { dateKeyFromDate, formatMoney, formatPercent, formatR, toneOf } from '../../../utils/tradeAnalytics'
import { SERIF } from '../../auth/authStyles'
import { stepEnter } from '../../feedback/formParts'
import { focusRing } from '../../common/controlStyles'

// Pieces shared by the review report, the date-range panel and the review history.

export const PERIOD_WORDS = {
  week: { thisPeriod: 'this week', next: 'Next week', nextLower: 'next week' },
  range: { thisPeriod: 'in this period', next: 'Next steps', nextLower: 'in the next period' }
}

/* ------------------------------ helpers ------------------------------ */

export const parseKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const shiftDays = (key, days) => {
  const date = parseKey(key)
  date.setDate(date.getDate() + days)
  return dateKeyFromDate(date)
}

/** Monday of the week that holds `key` (weeks run Monday to Sunday). */
export const mondayOf = (key) => shiftDays(key, -((parseKey(key).getDay() + 6) % 7))

export const errorText = (error) => (error instanceof TypeError ? "Can't reach the server. Check your connection and try again." : error?.message || 'Something went wrong')

export const DISCIPLINE = {
  followed: { label: 'Followed your rules', tone: 'positive' },
  mostly_followed: { label: 'Mostly followed', tone: 'positive' },
  partly_followed: { label: 'Partly followed', tone: 'warning' },
  not_followed: { label: 'Did not follow', tone: 'negative' },
  cannot_assess: { label: 'Not enough to judge', tone: 'neutral' }
}

export const STRATEGY_VERDICT = {
  keep: { label: 'Keep the strategy', tone: 'positive' },
  tweak: { label: 'Tweak the strategy', tone: 'warning' },
  rethink: { label: 'Rethink the strategy', tone: 'negative' }
}

export const RULE_STATUS = {
  followed: { label: 'Followed', dot: 'bg-emerald-600 dark:bg-emerald-300' },
  broken: { label: 'Broken', dot: 'bg-rose-600 dark:bg-rose-300' },
  unclear: { label: "Can't tell", dot: 'bg-zinc-400 dark:bg-zinc-500' }
}

// Plans that were not taken and trades without a plan are facts, never faults, so none of these use a negative tone.
export const PLAN_STATUS = {
  executed_as_planned: { label: 'Executed as planned', tone: 'positive' },
  executed_with_differences: { label: 'Executed with differences', tone: 'warning' },
  plan_not_taken: { label: 'Not triggered or skipped', tone: 'neutral' },
  unplanned_trade: { label: 'No plan for this trade', tone: 'neutral' }
}

export const pillTone = {
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  negative: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-300'
}

export const moneyTone = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

export const buttonPrimary = `inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`
export const buttonQuiet = `inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-3.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.07] ${focusRing}`

/**
 * One answer to "may a new review be written right now?", for the weekly and the date-range tab alike.
 * A review of either kind counts against the same allowance (1 a day, 3 a week), so the tab being looked at also
 * honours what the other tab (or another device) already used: `quota` is the shared, freshest copy from the
 * dialog, `access` is what this tab's own request returned, `otherBusy` is true while the other tab is writing.
 */
export const resolveLock = (access, quota, otherBusy = false) => {
  if (!access) return { locked: false, reason: null, message: '' }
  if (access.needsReview === false) return { locked: true, reason: 'up_to_date', message: '' }
  if (access.reason === 'not_enough_trades') return { locked: true, reason: access.reason, message: access.message }

  const shared = quota ?? access.quota ?? null
  const limitStillOn = Boolean(shared?.blocked) && (!shared.nextAvailableAt || new Date(shared.nextAvailableAt).getTime() > Date.now())
  if (limitStillOn) return { locked: true, reason: shared.reason, message: shared.message }

  if (otherBusy || shared?.generating) {
    return { locked: true, reason: 'busy_other', message: 'Another review is still being written. It counts toward your allowance only if it is delivered; try again when it finishes.' }
  }
  return { locked: !access.canGenerate, reason: access.reason, message: access.message }
}

/** "Reviews: 0/1 today - 1/3 this week", the allowance both tabs draw from. */
export const usageLine = (usage) => (usage ? `Reviews: ${usage.day.used}/${usage.day.limit} today \u00b7 ${usage.week.used}/${usage.week.limit} this week` : '')

/** "2 of 3 reviews left this week", or "none left today" while a cap is hit: what a review would draw from. */
export const allowanceText = (usage) => {
  if (!usage) return ''
  const weekLeft = Math.max(usage.week.limit - usage.week.used, 0)
  const dayLeft = Math.max(usage.day.limit - usage.day.used, 0)
  if (dayLeft === 0) return 'No reviews left today'
  if (weekLeft === 0) return 'No reviews left this week'
  return `${weekLeft} of ${usage.week.limit} reviews left this week`
}

/* ---------------------------- small pieces ---------------------------- */

export function TradeChips({ trades }) {
  if (!trades?.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {trades.map((label) => (
        <span key={label} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
          {label}
        </span>
      ))}
    </div>
  )
}

export function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${pillTone[tone]}`}>{children}</span>
}

export function WeekStats({ week, currency }) {
  const items = [
    { label: 'Net P&L', value: formatMoney(week.closed ? week.netPnl : null, { currency, signed: true }), tone: week.closed ? toneOf(week.netPnl) : 'neutral' },
    { label: 'Trades', value: String(week.trades) },
    { label: 'Win rate', value: formatPercent(week.winRate) },
    { label: 'Avg RRR', value: formatR(week.avgRrr) }
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:grid-cols-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
      {items.map(({ label, value, tone = 'neutral' }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
          <dd className={`mt-1 truncate text-[15px] font-semibold tabular-nums ${moneyTone[tone]}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ReviewSkeleton({ message }) {
  return (
    <div className={`space-y-6 ${stepEnter}`} role="status" aria-live="polite">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      <div className="space-y-2.5">
        {[92, 100, 78, 60].map((width, index) => (
          <div key={index} className="h-3 animate-pulse rounded-full bg-zinc-200 dark:bg-white/[0.08]" style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }} />
        ))}
      </div>
      <div className="grid gap-3 pt-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-white/[0.05]" style={{ animationDelay: `${index * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className={`flex min-h-[300px] flex-col items-center justify-center px-6 py-6 text-center ${stepEnter}`}>
      <h3 className={`${SERIF} text-[22px] font-medium tracking-[-0.02em] text-zinc-900 dark:text-zinc-50`}>{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-zinc-600 dark:text-zinc-400">{children}</p>
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------- review ------------------------------- */

// The review itself (verdict, next steps, rules, folds) lives in ReviewReport.jsx. These are the building blocks it shares.

/** Row that opens and closes its details. Rows without details render as plain rows. */
export function Collapsible({ header, children, defaultOpen = false, hasBody = true }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!hasBody) return <div className="px-5 py-4">{header}</div>
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full cursor-pointer items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDownIcon className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className={`px-5 pb-5 ${stepEnter}`}>{children}</div>}
    </div>
  )
}

export const listBox = 'divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.08]'

// Long paragraphs show three lines with a "Read more" toggle; short ones are shown whole.
export const CLAMP_FROM = 220

export function Clamp({ children, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = String(children ?? '').length > CLAMP_FROM

  return (
    <div>
      <p className={`${className} ${isLong && !expanded ? 'line-clamp-3' : ''}`}>{children}</p>
      {isLong && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className={`mt-2 cursor-pointer rounded text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300 ${focusRing}`}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}
