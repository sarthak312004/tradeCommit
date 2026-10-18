import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '../../../utils/Icons.jsx'
import { createAiReview, getAiQuota, getAiReview } from '../../../services/aiReviewApi'
import { dateKeyFromDate, formatDateKey } from '../../../utils/tradeAnalytics'
import { focusRing } from '../../common/controlStyles'
import SparklesIcon from './SparklesIcon'
import ListenControls from './ListenControls'
import RangeReviewPanel from './RangeReviewPanel'
import ReviewHistoryPanel from './ReviewHistoryPanel'
import { EmptyState, Review, ReviewSkeleton, WeekStats, buttonPrimary, buttonQuiet, errorText, mondayOf, resolveLock, shiftDays, usageLine } from './reviewParts'

/* ------------------------------- dialog ------------------------------- */

const MODES = [
  { id: 'week', label: 'Weekly' },
  { id: 'range', label: 'Date range' },
  { id: 'history', label: 'History' }
]

/**
 * The AI mentor, in three tabs: a weekly review, a review of any date range (for swing traders whose trades span
 * weeks) and the history of every past review. Opening it (or browsing) only loads what is saved and never spends AI
 * quota. A new review is written only when the trader presses the button, and the server unlocks that button after
 * enough trades (5) and within a per-trader allowance (1 a day, 3 a week), so the shared free-tier quota stretches
 * across many traders.
 * The allowance is ONE pool for the Weekly and the Date range tabs: a review written in either one counts in both.
 * The dialog keeps the freshest copy of it (`quota`), refreshes it on every tab switch and hands it to both tabs.
 * Both tabs stay mounted once opened, so a review being written in one is never lost when you look at the other.
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function AiMentorDialog({ journalId, journalName, currency, onClose, onOpenContext, initialRange = null }) {
  const [mode, setMode] = useState('week') // 'week' | 'range' | 'history'
  // dates handed to the range tab when a review is reopened from the history
  const [rangeSeed, setRangeSeed] = useState(null)
  const currentWeek = useRef(mondayOf(dateKeyFromDate(new Date()))).current
  const [weekStart, setWeekStart] = useState(currentWeek)
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('loading') // 'loading' | 'generating' | 'ready'
  const [error, setError] = useState('')
  // the allowance shared by weekly and date-range reviews, and whether the date-range tab is writing a review
  const [quota, setQuota] = useState(null)
  const [rangeBusy, setRangeBusy] = useState(false)
  const [rangeOpened, setRangeOpened] = useState(false)
  const [rangeKey, setRangeKey] = useState(0)
  const requestId = useRef(0)
  const dialogRef = useRef(null)

  // every response carries the allowance as the server sees it right now; the newest one wins
  const reportAccess = useCallback((access) => {
    if (access?.quota) setQuota(access.quota)
  }, [])

  const refreshQuota = useCallback(async () => {
    try {
      setQuota(await getAiQuota(journalId))
    } catch (quotaError) {
      console.error('Could not refresh the review allowance:', quotaError)
    }
  }, [journalId])

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const generate = useCallback(
    async (week) => {
      const id = ++requestId.current
      setPhase('generating')
      setError('')
      try {
        const next = await createAiReview(journalId, week)
        if (id !== requestId.current) return
        setData(next)
        reportAccess(next.access)
      } catch (generateError) {
        if (id !== requestId.current) return
        setError(errorText(generateError))
      }
      if (id === requestId.current) setPhase('ready')
    },
    [journalId, reportAccess]
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
          reportAccess(latest.access)
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
  }, [phase, journalId, weekStart, reportAccess])

  const load = useCallback(
    async (week) => {
      const id = ++requestId.current
      setPhase('loading')
      setError('')
      setData(null)
      try {
        const next = await getAiReview(journalId, week)
        if (id !== requestId.current) return
        setData(next)
        reportAccess(next.access)
      } catch (loadError) {
        if (id !== requestId.current) return
        setError(errorText(loadError))
      }
      setPhase('ready')
    },
    [journalId, reportAccess]
  )

  // first open: show the current week's saved review (or the button that unlocks one); nothing is generated by opening
  useEffect(() => {
    load(currentWeek)
    return () => {
      requestId.current += 1
    }
  }, [load, currentWeek])

  const goToWeek = (week) => {
    setWeekStart(week)
    load(week)
  }

  const selectMode = (next) => {
    // the date-range tab stays mounted while hidden, so stop any read-aloud explicitly when leaving a tab
    if (next !== mode) window.speechSynthesis?.cancel()
    setMode(next)
    if (next === 'range') setRangeOpened(true)
    // a review written in the other tab already used the shared allowance: pick that up on every switch
    if (next === 'week' || next === 'range') refreshQuota()
  }

  // a review opened from the history that needs updating goes back to the tab it was written in
  const openFromHistory = (item) => {
    if (item.kind === 'range') {
      setRangeSeed({ from: item.start, to: item.end })
      setRangeKey((value) => value + 1) // a fresh range tab for the dates being reopened
      setRangeOpened(true)
      setMode('range')
      refreshQuota()
    } else {
      setMode('week')
      goToWeek(item.start)
      refreshQuota()
    }
  }

  const weekEnd = shiftDays(weekStart, 6)
  const isCurrentWeek = weekStart >= currentWeek
  const weekLabel = `${formatDateKey(weekStart)} - ${formatDateKey(weekEnd)}`
  const review = data?.review ?? null
  const access = data?.access ?? null
  const lock = resolveLock(access, quota, rangeBusy)
  const locked = lock.locked

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
            <button type="button" onClick={() => (data && !locked ? generate(weekStart) : load(weekStart))} className={buttonPrimary}>
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
      const notYetUnlocked = locked && lock.reason === 'not_enough_trades'
      return (
        <EmptyState
          title={notYetUnlocked ? 'Log a few more trades' : lock.reason === 'daily_limit' || lock.reason === 'weekly_limit' ? 'Come back for the next review' : 'No review for this week yet'}
          action={
            <button type="button" onClick={() => generate(weekStart)} disabled={locked} className={buttonPrimary}>
              Review this week
            </button>
          }
        >
          {locked
            ? lock.message
            : `${data?.tradeCount ?? 0} trade${data?.tradeCount === 1 ? '' : 's'} logged. The mentor compares each one with your strategy${data?.planner?.connected ? ', the plans in your connected planner' : ''} and your journal's history.`}
        </EmptyState>
      )
    }

    return (
      <div className="space-y-7">
        {data.week && <WeekStats week={data.week} currency={currency} />}
        {data.stale && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-3.5 text-[13px] leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <span>
              Your trades, strategy or plans changed after this review was written.
              {locked && lock.message ? ` ${lock.message}` : ''}
            </span>
            {!locked && (
              <button type="button" onClick={() => generate(weekStart)} className="cursor-pointer font-medium underline-offset-2 hover:underline">
                Update review
              </button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-[13px] leading-6 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <ListenControls review={review} />
        <Review key={`${weekStart}-${data.generatedAt ?? ''}`} review={review} />
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mentor review"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none dark:border-white/[0.14] dark:bg-panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
              <SparklesIcon className="h-[18px] w-[18px]" />
              <h3 className="text-lg font-semibold tracking-[-0.03em]">Mentor review</h3>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{journalName}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {mode === 'week' && (
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
            )}
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

        <div role="tablist" aria-label="Kind of review" className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-8 dark:border-white/[0.08]">
          {MODES.map((item) => {
            const active = mode === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectMode(item.id)}
                className={`inline-flex h-10 cursor-pointer items-center whitespace-nowrap border-b-2 px-3.5 text-[13px] font-medium transition-colors ${focusRing} ${
                  active
                    ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                    : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* the only scroller in the dialog; its thumb shows on hover, and nothing inside it scrolls sideways */}
        <div className="quiet-scrollbar min-h-[360px] flex-1 overflow-y-auto overflow-x-hidden px-8 pb-8">
          {/* top spacing lives here, not on the scroller: padding on the scroller leaves a gap above the sticky review tabs where content shows through */}
          <div className="pt-6">
            {mode === 'week' && renderBody()}
            {rangeOpened && (
              <div hidden={mode !== 'range'}>
                <RangeReviewPanel
                  key={rangeKey}
                  journalId={journalId}
                  currency={currency}
                  seed={rangeSeed}
                  journalRange={initialRange}
                  onOpenContext={onOpenContext}
                  quota={quota}
                  onAccess={reportAccess}
                  otherBusy={phase === 'generating'}
                  onBusyChange={setRangeBusy}
                />
              </div>
            )}
            {mode === 'history' && <ReviewHistoryPanel journalId={journalId} currency={currency} onUpdate={openFromHistory} />}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-zinc-200 px-8 py-3.5 text-[11px] text-zinc-500 dark:border-white/[0.08] dark:text-zinc-400">
          <span className="min-w-0 truncate">
            {mode === 'week' && review && data?.generatedAt
              ? `Written ${new Date(data.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. `
              : ''}
            AI feedback from your own logs, not financial advice.
          </span>
          {mode !== 'history' && (quota?.usage ?? access?.usage) && (
            <span className="shrink-0 tabular-nums" title="Reviews you have generated recently, weekly and date range together. Looking at saved reviews is free.">
              {usageLine(quota?.usage ?? access?.usage)}
            </span>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default AiMentorDialog
