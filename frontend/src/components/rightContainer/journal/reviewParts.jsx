import { useState } from 'react'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from '../../../utils/Icons.jsx'
import { dateKeyFromDate, formatDateKey, formatMoney, formatPercent, formatR, toneOf } from '../../../utils/tradeAnalytics'
import { SERIF } from '../../auth/authStyles'
import { stepEnter } from '../../feedback/formParts'
import { focusRing } from '../../common/controlStyles'

// Pieces shared by the weekly review, the date-range review and the review history. Moved out of AiMentorDialog.jsx
// unchanged, except that every piece is exported and `Review` takes a `period` ('week' | 'range') for its wording.

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
    <dl className="grid grid-cols-4 gap-3 rounded-xl border border-zinc-200 px-4 py-3 dark:border-white/[0.08]">
      {items.map(({ label, value, tone = 'neutral' }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
          <dd className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${moneyTone[tone]}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ReviewSkeleton({ message }) {
  return (
    <div className={`space-y-5 ${stepEnter}`} role="status" aria-live="polite">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      <div className="space-y-2.5">
        {[92, 100, 78, 60].map((width, index) => (
          <div key={index} className="h-3 animate-pulse rounded-full bg-zinc-200 dark:bg-white/[0.08]" style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }} />
        ))}
      </div>
      <div className="grid gap-2.5 pt-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-white/[0.05]" style={{ animationDelay: `${index * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <div className={`flex min-h-[260px] flex-col items-center justify-center px-4 text-center ${stepEnter}`}>
      <h3 className={`${SERIF} text-[22px] font-medium tracking-[-0.02em] text-zinc-900 dark:text-zinc-50`}>{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">{children}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------- review ------------------------------- */

// The review is split into tabs so nobody has to scroll one long page: a short Overview first, details a tap away.

/** Row that opens and closes its details. Rows without details render as plain rows. */
export function Collapsible({ header, children, defaultOpen = false, hasBody = true }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!hasBody) return <div className="px-4 py-3">{header}</div>
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDownIcon className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className={`px-4 pb-3.5 ${stepEnter}`}>{children}</div>}
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
        <button type="button" onClick={() => setExpanded((value) => !value)} className={`mt-1 cursor-pointer rounded text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300 ${focusRing}`}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  )
}

export function SnapshotCard({ label, onClick, children, note }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 cursor-pointer flex-col items-start gap-2 rounded-xl border border-zinc-200 p-3.5 text-left transition-colors hover:bg-zinc-50 dark:border-white/[0.08] dark:hover:bg-white/[0.04] ${focusRing}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
      {note && <span className="text-xs text-zinc-600 dark:text-zinc-400">{note}</span>}
    </button>
  )
}

export function Highlight({ tone, label, text, onClick }) {
  const dot = tone === 'positive' ? 'bg-emerald-600 dark:bg-emerald-300' : 'bg-rose-600 dark:bg-rose-300'
  return (
    <button type="button" onClick={onClick} className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}>
      <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="mt-0.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{text}</span>
      </span>
      <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
    </button>
  )
}

export function OverviewTab({ review, discipline, strategy, goTo, words }) {
  const days = review.planAlignment?.days ?? []
  const hasPlan = Boolean(review.planAlignment && (review.planAlignment.summary || days.length))
  const asPlanned = days.filter((day) => day.status === 'executed_as_planned').length
  const strength = review.strengths[0]
  const issue = review.issues[0]
  const firstAction = review.nextWeek[0]

  return (
    <div className="space-y-5">
      <div>
        <h2 className={`${SERIF} text-[26px] font-medium leading-[1.15] tracking-[-0.025em] text-zinc-900 dark:text-zinc-50`}>{review.headline}</h2>
        <div className="mt-3">
          <Clamp className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.summary}</Clamp>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <SnapshotCard label="Discipline" onClick={() => goTo('rules')} note={review.discipline.score !== null ? `${review.discipline.score}% of checkable rules` : undefined}>
          <Pill tone={discipline.tone}>{discipline.label}</Pill>
        </SnapshotCard>
        <SnapshotCard label="Strategy" onClick={() => goTo('strategy')} note={review.strategyFeedback.suggestedChanges.length ? `${review.strategyFeedback.suggestedChanges.length} change${review.strategyFeedback.suggestedChanges.length === 1 ? '' : 's'} to test` : undefined}>
          <Pill tone={strategy.tone}>{strategy.label}</Pill>
        </SnapshotCard>
        {hasPlan ? (
          <SnapshotCard label="Plan" onClick={() => goTo('plan')} note={days.length ? `${asPlanned} of ${days.length} day${days.length === 1 ? '' : 's'} as planned` : undefined}>
            <Pill tone={days.length && asPlanned === days.length ? 'positive' : 'neutral'}>{days.length && asPlanned === days.length ? 'On plan' : 'Plan vs execution'}</Pill>
          </SnapshotCard>
        ) : (
          <SnapshotCard label={words.next} onClick={() => goTo('next')} note={review.nextWeek.length ? `${review.nextWeek.length} action${review.nextWeek.length === 1 ? '' : 's'}` : undefined}>
            <Pill tone="neutral">Your focus</Pill>
          </SnapshotCard>
        )}
      </div>

      {(strength || issue || firstAction) && (
        <div className={listBox}>
          {strength && <Highlight tone="positive" label={`Best thing ${words.thisPeriod}`} text={strength.title} onClick={() => goTo('insights')} />}
          {issue && <Highlight tone="negative" label="Biggest thing to fix" text={issue.title} onClick={() => goTo('insights')} />}
          {firstAction && (
            <button type="button" onClick={() => goTo('next')} className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}>
              <span aria-hidden="true" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">1</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Do this first {words.nextLower}</span>
                <span className="mt-0.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{firstAction}</span>
              </span>
              <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
            </button>
          )}
        </div>
      )}

      {review.mentorNote && (
        <p className={`${SERIF} border-l-2 border-zinc-300 pl-4 text-[17px] italic leading-7 text-zinc-700 dark:border-white/20 dark:text-zinc-300`}>{review.mentorNote}</p>
      )}
    </div>
  )
}

export const RULE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'broken', label: 'Broken' },
  { id: 'followed', label: 'Followed' },
  { id: 'unclear', label: "Can't tell" }
]
export const RULE_ORDER = { broken: 0, unclear: 1, followed: 2 }

export function RulesTab({ review, discipline }) {
  const [filter, setFilter] = useState('all')
  const checks = review.ruleChecks
  const counts = { followed: 0, broken: 0, unclear: 0 }
  for (const check of checks) counts[RULE_STATUS[check.status] ? check.status : 'unclear'] += 1

  // broken rules first: those are what needs attention
  const shown = checks
    .filter((check) => filter === 'all' || (RULE_STATUS[check.status] ? check.status : 'unclear') === filter)
    .sort((a, b) => (RULE_ORDER[a.status] ?? 1) - (RULE_ORDER[b.status] ?? 1))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={discipline.tone}>{discipline.label}</Pill>
        {review.discipline.score !== null && <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{review.discipline.score}% of checkable rules</span>}
      </div>
      <Clamp className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.discipline.explanation}</Clamp>

      {checks.length > 0 && (
        <>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/[0.08]" role="img" aria-label={`${counts.followed} followed, ${counts.broken} broken, ${counts.unclear} unclear`}>
            <span className="bg-emerald-600 dark:bg-emerald-400" style={{ width: `${(counts.followed / checks.length) * 100}%` }} />
            <span className="bg-rose-600 dark:bg-rose-400" style={{ width: `${(counts.broken / checks.length) * 100}%` }} />
          </div>

          <div role="group" aria-label="Filter rules" className="flex flex-wrap gap-1.5">
            {RULE_FILTERS.map((item) => {
              const count = item.id === 'all' ? checks.length : counts[item.id]
              if (item.id !== 'all' && count === 0) return null
              const active = filter === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.id)}
                  className={`h-7 cursor-pointer rounded-full border px-3 text-xs font-medium tabular-nums transition-colors ${focusRing} ${
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.14] dark:text-zinc-300 dark:hover:bg-white/[0.07]'
                  }`}
                >
                  {item.label} {count}
                </button>
              )
            })}
          </div>

          <ul className={listBox}>
            {shown.map((check, index) => {
              const status = RULE_STATUS[check.status] ?? RULE_STATUS.unclear
              return (
                <li key={`${check.rule}-${index}`}>
                  <Collapsible
                    defaultOpen={check.status === 'broken'}
                    hasBody={Boolean(check.evidence) || Boolean(check.trades?.length)}
                    header={
                      <span className="flex items-start gap-3">
                        <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                        <span className="min-w-0 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {check.rule} <span className="ml-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">{status.label}</span>
                        </span>
                      </span>
                    }
                  >
                    <div className="pl-5">
                      {check.evidence && <p className="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{check.evidence}</p>}
                      <TradeChips trades={check.trades} />
                    </div>
                  </Collapsible>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

export function PlanTab({ review }) {
  const plan = review.planAlignment
  return (
    <div className="space-y-4">
      {plan.summary && <Clamp className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{plan.summary}</Clamp>}
      {plan.days.length > 0 && (
        <ul className={listBox}>
          {plan.days.map((day, index) => {
            const status = PLAN_STATUS[day.status] ?? PLAN_STATUS.plan_not_taken
            return (
              <li key={`${day.date}-${index}`}>
                <Collapsible
                  hasBody={Boolean(day.detail) || Boolean(day.trades?.length)}
                  header={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{formatDateKey(day.date)}</span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </span>
                  }
                >
                  {day.detail && <p className="text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{day.detail}</p>}
                  <TradeChips trades={day.trades} />
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function InsightGroup({ title, items, dot }) {
  if (!items.length) return null
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
        {title} <span className="tabular-nums">({items.length})</span>
      </h3>
      <ul className={listBox}>
        {items.map((item, index) => (
          <li key={item.title}>
            <Collapsible
              defaultOpen={index === 0}
              hasBody={Boolean(item.detail) || Boolean(item.trades?.length)}
              header={<span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>}
            >
              {item.detail && <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.detail}</p>}
              <TradeChips trades={item.trades} />
            </Collapsible>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function InsightsTab({ review }) {
  return (
    <div className="space-y-5">
      <InsightGroup title="What went well" items={review.strengths} dot="bg-emerald-600 dark:bg-emerald-300" />
      <InsightGroup title="Where to work" items={review.issues} dot="bg-rose-600 dark:bg-rose-300" />
    </div>
  )
}

export function StrategyTab({ review, strategy }) {
  const { suggestedChanges, marketAdaptation, reasoning } = review.strategyFeedback
  return (
    <div className="space-y-4">
      <Pill tone={strategy.tone}>{strategy.label}</Pill>
      <Clamp className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{reasoning}</Clamp>

      {suggestedChanges.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Worth testing</h3>
          <ul className="space-y-2">
            {suggestedChanges.map((change) => (
              <li key={change} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-700 dark:border-white/[0.08] dark:text-zinc-300">
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {marketAdaptation && (
        <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-white/[0.05]">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Adapting to the market</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{marketAdaptation}</p>
        </div>
      )}
    </div>
  )
}

export function NextWeekTab({ review }) {
  // ticking is only a reading aid, so it lives in this tab and is not saved
  const [done, setDone] = useState(() => new Set())
  const toggle = (index) =>
    setDone((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  return (
    <div className="space-y-3">
      <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{done.size} of {review.nextWeek.length} ticked off</p>
      <ul className="space-y-2">
        {review.nextWeek.map((action, index) => {
          const checked = done.has(index)
          return (
            <li key={action}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggle(index)}
                className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-white/[0.08] dark:hover:bg-white/[0.04] ${focusRing}`}
              >
                <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${checked ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-950' : 'border-zinc-400 dark:border-zinc-500'}`}>
                  {checked && <CheckIcon className="h-3.5 w-3.5" />}
                </span>
                <span className={`text-sm leading-6 ${checked ? 'text-zinc-500 line-through dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>{action}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Review({ review, period = 'week' }) {
  const words = PERIOD_WORDS[period] ?? PERIOD_WORDS.week
  const discipline = DISCIPLINE[review.discipline.verdict] ?? DISCIPLINE.cannot_assess
  const strategy = STRATEGY_VERDICT[review.strategyFeedback.verdict] ?? STRATEGY_VERDICT.keep
  const [tab, setTab] = useState('overview')

  const hasPlan = Boolean(review.planAlignment && (review.planAlignment.summary || review.planAlignment.days.length))
  const insightCount = review.strengths.length + review.issues.length
  const brokenCount = review.ruleChecks.filter((check) => check.status === 'broken').length

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'rules', label: 'Rules', count: review.ruleChecks.length || undefined, alert: brokenCount > 0 },
    hasPlan && { id: 'plan', label: 'Plan' },
    insightCount > 0 && { id: 'insights', label: 'Insights', count: insightCount },
    { id: 'strategy', label: 'Strategy' },
    review.nextWeek.length > 0 && { id: 'next', label: words.next, count: review.nextWeek.length }
  ].filter(Boolean)

  const handleKeyDown = (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = tabs.findIndex((item) => item.id === tab)
    const next = tabs[(index + step + tabs.length) % tabs.length]
    setTab(next.id)
    document.getElementById(`review-tab-${next.id}`)?.focus()
  }

  return (
    <div>
      {/* sticky inside the dialog's scroll area, so the tabs stay reachable while a long tab scrolls */}
      <div className="sticky top-0 z-10 -mx-6 bg-white px-6 pb-3 dark:bg-panel">
        <div role="tablist" aria-label="Review sections" onKeyDown={handleKeyDown} className="subtle-scrollbar flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/[0.08]">
          {tabs.map((item) => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                id={`review-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="review-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(item.id)}
                className={`-mb-px inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13px] font-medium transition-colors ${focusRing} ${
                  active
                    ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${item.alert ? 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300' : 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-300'}`}>{item.count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div key={tab} id="review-panel" role="tabpanel" aria-labelledby={`review-tab-${tab}`} className={`pt-1 ${stepEnter}`}>
        {tab === 'overview' && <OverviewTab review={review} discipline={discipline} strategy={strategy} goTo={setTab} words={words} />}
        {tab === 'rules' && <RulesTab review={review} discipline={discipline} />}
        {tab === 'plan' && hasPlan && <PlanTab review={review} />}
        {tab === 'insights' && <InsightsTab review={review} />}
        {tab === 'strategy' && <StrategyTab review={review} strategy={strategy} />}
        {tab === 'next' && <NextWeekTab review={review} />}
      </div>
    </div>
  )
}

