import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../../../utils/Icons.jsx'
import { createAiReview, getAiReview } from '../../../services/aiReviewApi'
import { dateKeyFromDate, formatDateKey, formatMoney, formatPercent, formatR, toneOf } from '../../../utils/tradeAnalytics'
import { SERIF } from '../../auth/authStyles'
import { stepEnter } from '../../feedback/formParts'
import { focusRing } from '../../common/controlStyles'
import SparklesIcon from './SparklesIcon'
import ListenControls from './ListenControls'

/* ------------------------------ helpers ------------------------------ */

const parseKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const shiftDays = (key, days) => {
  const date = parseKey(key)
  date.setDate(date.getDate() + days)
  return dateKeyFromDate(date)
}

/** Monday of the week that holds `key` (weeks run Monday to Sunday). */
const mondayOf = (key) => shiftDays(key, -((parseKey(key).getDay() + 6) % 7))

const errorText = (error) => (error instanceof TypeError ? "Can't reach the server. Check your connection and try again." : error?.message || 'Something went wrong')

const DISCIPLINE = {
  followed: { label: 'Followed your rules', tone: 'positive' },
  mostly_followed: { label: 'Mostly followed', tone: 'positive' },
  partly_followed: { label: 'Partly followed', tone: 'warning' },
  not_followed: { label: 'Did not follow', tone: 'negative' },
  cannot_assess: { label: 'Not enough to judge', tone: 'neutral' }
}

const STRATEGY_VERDICT = {
  keep: { label: 'Keep the strategy', tone: 'positive' },
  tweak: { label: 'Tweak the strategy', tone: 'warning' },
  rethink: { label: 'Rethink the strategy', tone: 'negative' }
}

const RULE_STATUS = {
  followed: { label: 'Followed', dot: 'bg-emerald-600 dark:bg-emerald-300' },
  broken: { label: 'Broken', dot: 'bg-rose-600 dark:bg-rose-300' },
  unclear: { label: "Can't tell", dot: 'bg-zinc-400 dark:bg-zinc-500' }
}

// Plans that were not taken and trades without a plan are facts, never faults, so none of these use a negative tone.
const PLAN_STATUS = {
  executed_as_planned: { label: 'Executed as planned', tone: 'positive' },
  executed_with_differences: { label: 'Executed with differences', tone: 'warning' },
  plan_not_taken: { label: 'Not triggered or skipped', tone: 'neutral' },
  unplanned_trade: { label: 'No plan for this trade', tone: 'neutral' }
}

const pillTone = {
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  negative: 'bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300',
  neutral: 'bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-300'
}

const moneyTone = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-rose-500 dark:text-rose-400',
  neutral: 'text-zinc-900 dark:text-zinc-100'
}

const buttonPrimary = `inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white ${focusRing}`
const buttonQuiet = `inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-zinc-300 px-3.5 text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.07] ${focusRing}`

/* ---------------------------- small pieces ---------------------------- */

function Section({ title, children }) {
  return (
    <section className="border-t border-zinc-200 pt-5 dark:border-white/[0.08]">
      <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{title}</h3>
      {children}
    </section>
  )
}

function TradeChips({ trades }) {
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

function Pill({ tone, children }) {
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${pillTone[tone]}`}>{children}</span>
}

function WeekStats({ week, currency }) {
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

function ReviewSkeleton({ message }) {
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

function EmptyState({ title, children, action }) {
  return (
    <div className={`flex min-h-[260px] flex-col items-center justify-center px-4 text-center ${stepEnter}`}>
      <h3 className={`${SERIF} text-[22px] font-medium tracking-[-0.02em] text-zinc-900 dark:text-zinc-50`}>{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">{children}</p>
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------- review ------------------------------- */

function Review({ review }) {
  const discipline = DISCIPLINE[review.discipline.verdict] ?? DISCIPLINE.cannot_assess
  const strategy = STRATEGY_VERDICT[review.strategyFeedback.verdict] ?? STRATEGY_VERDICT.keep

  return (
    <div className={`space-y-6 ${stepEnter}`}>
      <div>
        <h2 className={`${SERIF} text-[26px] font-medium leading-[1.15] tracking-[-0.025em] text-zinc-900 dark:text-zinc-50`}>{review.headline}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.summary}</p>
      </div>

      <Section title="Did you follow your strategy?">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={discipline.tone}>{discipline.label}</Pill>
          {review.discipline.score !== null && <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{review.discipline.score}% of checkable rules</span>}
        </div>
        <p className="mt-2.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.discipline.explanation}</p>

        {review.ruleChecks.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.08]">
            {review.ruleChecks.map((check, index) => {
              const status = RULE_STATUS[check.status] ?? RULE_STATUS.unclear
              return (
                <li key={`${check.rule}-${index}`} className="flex gap-3 px-4 py-3">
                  <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${status.dot}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {check.rule} <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">{status.label}</span>
                    </p>
                    {check.evidence && <p className="mt-0.5 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{check.evidence}</p>}
                    <TradeChips trades={check.trades} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {review.planAlignment && (
        <Section title="Plan vs execution">
          {review.planAlignment.summary && <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.planAlignment.summary}</p>}
          {review.planAlignment.days.length > 0 && (
            <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.08]">
              {review.planAlignment.days.map((day, index) => {
                const status = PLAN_STATUS[day.status] ?? PLAN_STATUS.plan_not_taken
                return (
                  <li key={`${day.date}-${index}`} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{formatDateKey(day.date)}</span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </div>
                    {day.detail && <p className="mt-1.5 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{day.detail}</p>}
                    <TradeChips trades={day.trades} />
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {review.strengths.length > 0 && (
        <Section title="What went well">
          <ul className="space-y-3">
            {review.strengths.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {review.issues.length > 0 && (
        <Section title="Where to work">
          <ul className="space-y-3">
            {review.issues.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{item.detail}</p>
                <TradeChips trades={item.trades} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Your strategy">
        <Pill tone={strategy.tone}>{strategy.label}</Pill>
        <p className="mt-2.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.strategyFeedback.reasoning}</p>

        {review.strategyFeedback.suggestedChanges.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Worth testing</p>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
              {review.strategyFeedback.suggestedChanges.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        )}

        {review.strategyFeedback.marketAdaptation && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Adapting to the market</p>
            <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{review.strategyFeedback.marketAdaptation}</p>
          </div>
        )}
      </Section>

      {review.nextWeek.length > 0 && (
        <Section title="Next week">
          <ol className="space-y-2.5">
            {review.nextWeek.map((action, index) => (
              <li key={action} className="flex gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[11px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{index + 1}</span>
                <span>{action}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {review.mentorNote && (
        <p className={`${SERIF} border-l-2 border-zinc-300 pl-4 text-[17px] italic leading-7 text-zinc-700 dark:border-white/20 dark:text-zinc-300`}>{review.mentorNote}</p>
      )}
    </div>
  )
}

/* ------------------------------- dialog ------------------------------- */

/**
 * The weekly AI mentor. Opens on the current week: shows the saved review when it is still current, otherwise asks the
 * mentor right away. Other weeks only load what is saved and offer a button, so browsing never spends AI quota.
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function AiMentorDialog({ journalId, journalName, currency, onClose, onOpenContext }) {
  const currentWeek = useRef(mondayOf(dateKeyFromDate(new Date()))).current
  const [weekStart, setWeekStart] = useState(currentWeek)
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('loading') // 'loading' | 'generating' | 'ready'
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const generate = useCallback(
    async (week, { force = false } = {}) => {
      const id = ++requestId.current
      setPhase('generating')
      setError('')
      try {
        const next = await createAiReview(journalId, week, { force })
        if (id !== requestId.current) return
        setData(next)
      } catch (generateError) {
        if (id !== requestId.current) return
        setError(errorText(generateError))
      }
      if (id === requestId.current) setPhase('ready')
    },
    [journalId]
  )

  useEffect(() => {
    if (phase !== 'generating') return

    const id = requestId.current
    let cancelled = false
    let timeoutId
    const checkForCompletedReview = async () => {
      try {
        const latest = await getAiReview(journalId, weekStart)
        if (cancelled || id !== requestId.current) return
        if (latest.review && !latest.stale) {
          setData(latest)
          setError('')
          setPhase('ready')
          return
        }
      } catch (pollError) {
        if (!cancelled && id === requestId.current) {
          console.error('Could not check whether the AI review has completed:', pollError)
        }
      }

      if (!cancelled) timeoutId = setTimeout(checkForCompletedReview, 4000)
    }

    timeoutId = setTimeout(checkForCompletedReview, 4000)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [phase, journalId, weekStart])

  const load = useCallback(
    async (week, autoGenerate) => {
      const id = ++requestId.current
      setPhase('loading')
      setError('')
      setData(null)
      try {
        const next = await getAiReview(journalId, week)
        if (id !== requestId.current) return
        setData(next)
        const needsReview = !next.review || next.stale
        if (autoGenerate && needsReview && next.hasStrategy && next.tradeCount > 0) {
          generate(week)
          return
        }
      } catch (loadError) {
        if (id !== requestId.current) return
        setError(errorText(loadError))
      }
      setPhase('ready')
    },
    [journalId, generate]
  )

  // first open: current week, and ask the mentor straight away when there is nothing current saved
  useEffect(() => {
    load(currentWeek, true)
    return () => {
      requestId.current += 1
    }
  }, [load, currentWeek])

  const goToWeek = (week) => {
    setWeekStart(week)
    load(week, false)
  }

  const weekEnd = shiftDays(weekStart, 6)
  const isCurrentWeek = weekStart >= currentWeek
  const weekLabel = `${formatDateKey(weekStart)} - ${formatDateKey(weekEnd)}`
  const review = data?.review ?? null
  const isBusy = phase !== 'ready'

  const renderBody = () => {
    if (phase === 'loading') return <ReviewSkeleton message="Opening this week..." />
    if (phase === 'generating') {
      const count = data?.tradeCount
      const what = count ? `${count} trade${count === 1 ? '' : 's'}` : 'trades'
      return <ReviewSkeleton message={`Reading your strategy and ${what}. This takes about 10 to 20 seconds.`} />
    }

    if (!review && error) {
      return (
        <EmptyState
          title="The mentor couldn't finish"
          action={
            <button type="button" onClick={() => (data ? generate(weekStart) : load(weekStart, true))} className={buttonPrimary}>
              Try again
            </button>
          }
        >
          {error}
        </EmptyState>
      )
    }

    if (data && !data.hasStrategy) {
      return (
        <EmptyState
          title="Write your strategy first"
          action={
            onOpenContext && (
              <button type="button" onClick={onOpenContext} className={buttonPrimary}>
                Open journal context
              </button>
            )
          }
        >
          The mentor checks every trade against the rules you committed to. Add your strategy in this journal's context (entries, risk per trade, stops, hours) and come back.
        </EmptyState>
      )
    }

    if (data && data.tradeCount === 0) {
      return (
        <EmptyState
          title="No trades this week"
          action={
            <button type="button" onClick={() => goToWeek(shiftDays(weekStart, -7))} className={buttonQuiet}>
              Previous week
            </button>
          }
        >
          {isCurrentWeek ? 'Log a trade dated this week and the mentor will review it, or look back at last week.' : 'Nothing was logged in this week.'}
        </EmptyState>
      )
    }

    if (!review) {
      return (
        <EmptyState
          title="No review for this week yet"
          action={
            <button type="button" onClick={() => generate(weekStart)} className={buttonPrimary}>
              Review this week
            </button>
          }
        >
          {data?.tradeCount ?? 0} trade{data?.tradeCount === 1 ? '' : 's'} logged. The mentor compares each one with your strategy{data?.planner?.connected ? ', the plans in your connected planner' : ''} and your journal's history.
        </EmptyState>
      )
    }

    return (
      <div className="space-y-6">
        {data.week && <WeekStats week={data.week} currency={currency} />}
        {data.stale && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <span>Your trades, strategy or plans changed after this review was written.</span>
            <button type="button" onClick={() => generate(weekStart, { force: true })} className="cursor-pointer font-medium underline-offset-2 hover:underline">
              Update review
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <ListenControls review={review} />
        <Review review={review} />
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Weekly mentor review"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <SparklesIcon className="h-4 w-4" />
              <h3 className="text-base font-semibold tracking-[-0.03em]">Mentor review</h3>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{journalName}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="flex items-center rounded-lg border border-zinc-300 dark:border-white/[0.14]">
              <button
                type="button"
                onClick={() => goToWeek(shiftDays(weekStart, -7))}
                disabled={phase === 'generating'}
                aria-label="Previous week"
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-l-lg text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.07] ${focusRing}`}
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[120px] px-1 text-center text-xs font-medium tabular-nums text-zinc-800 dark:text-zinc-200">{weekLabel}</span>
              <button
                type="button"
                onClick={() => goToWeek(shiftDays(weekStart, 7))}
                disabled={isCurrentWeek || phase === 'generating'}
                aria-label="Next week"
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-r-lg text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/[0.07] ${focusRing}`}
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`ml-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200 ${focusRing}`}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="subtle-scrollbar min-h-[320px] flex-1 overflow-y-auto px-6 pb-6 pt-3">{renderBody()}</div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-6 py-3 text-[11px] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
          <span className="min-w-0 truncate">
            {review && data?.generatedAt
              ? `Written ${new Date(data.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. `
              : ''}
            AI feedback from your own logs, not financial advice.
          </span>
          {review && (
            <button
              type="button"
              onClick={() => generate(weekStart, { force: true })}
              disabled={isBusy}
              className="shrink-0 cursor-pointer text-zinc-600 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Regenerate
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default AiMentorDialog
