import { useCallback, useEffect, useRef, useState } from 'react'
import { createRangeReview, previewRangeReview } from '../../../services/aiRangeReviewApi'
import { dateKeyFromDate, formatDateKey } from '../../../utils/tradeAnalytics'
import { focusRing } from '../../common/controlStyles'
import ListenControls from './ListenControls'
import { EmptyState, Review, ReviewSkeleton, WeekStats, buttonPrimary, errorText, resolveLock, shiftDays } from './reviewParts'

// Longest range one review may cover. The server enforces the same limit (AI_RANGE_MAX_DAYS, default 366).
export const MAX_RANGE_DAYS = 366

const dateInputClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 text-xs text-zinc-800 outline-none transition-colors [color-scheme:light] focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 dark:border-white/[0.14] dark:text-zinc-100 dark:[color-scheme:dark]'

const todayKey = () => dateKeyFromDate(new Date())

// Quick picks. Every range ends today at the latest: a review is about trades that already happened.
const PRESETS = [
  { id: '7d', label: 'Last 7 days', resolve: (today) => ({ from: shiftDays(today, -6), to: today }) },
  { id: '30d', label: 'Last 30 days', resolve: (today) => ({ from: shiftDays(today, -29), to: today }) },
  { id: '90d', label: 'Last 90 days', resolve: (today) => ({ from: shiftDays(today, -89), to: today }) },
  {
    id: 'month',
    label: 'This month',
    resolve: (today) => {
      const now = new Date()
      return { from: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
    }
  },
  {
    id: 'last-month',
    label: 'Last month',
    resolve: () => {
      const now = new Date()
      return { from: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: dateKeyFromDate(new Date(now.getFullYear(), now.getMonth(), 0)) }
    }
  },
  { id: 'year', label: 'This year', resolve: (today) => ({ from: `${today.slice(0, 4)}-01-01`, to: today }) }
]

const rangeFromPreset = (id) => ({ preset: id, ...PRESETS.find((item) => item.id === id).resolve(todayKey()) })

const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000) + 1

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

const pillButton = (active) =>
  `h-7 cursor-pointer rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
    active
      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
      : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.14] dark:text-zinc-300 dark:hover:bg-white/[0.07]'
  }`

/** Quick picks plus two date fields. Swing traders can cover a whole campaign in one go. */
function RangePicker({ range, onChange, disabled, journalRange, tradeCount }) {
  const today = todayKey()
  const days = range.from && range.to && range.from <= range.to ? daysBetween(range.from, range.to) : 0
  const tooLong = days > MAX_RANGE_DAYS
  const missing = !range.from || !range.to
  const journalFilterUsable = Boolean(journalRange?.from && journalRange?.to) && !(journalRange.from === range.from && journalRange.to === range.to)

  const changeCustom = (field, value) => {
    const next = { ...range, preset: 'custom', [field]: value }
    // keep the range valid: if the dates cross, move the other end along
    if (next.from && next.to && next.from > next.to) {
      if (field === 'from') next.to = value
      else next.from = value
    }
    onChange(next)
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div role="group" aria-label="Quick date ranges" className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" disabled={disabled} aria-pressed={range.preset === preset.id} onClick={() => onChange(rangeFromPreset(preset.id))} className={pillButton(range.preset === preset.id)}>
            {preset.label}
          </button>
        ))}
        {journalFilterUsable && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ preset: 'journal', from: journalRange.from, to: journalRange.to > today ? today : journalRange.to })}
            title="The date filter currently applied to this journal"
            className={pillButton(range.preset === 'journal')}
          >
            Journal filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] text-zinc-500 dark:text-zinc-400">From</span>
          <input type="date" disabled={disabled} value={range.from} max={range.to || today} onChange={(event) => changeCustom('from', event.target.value)} className={dateInputClass} />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] text-zinc-500 dark:text-zinc-400">To</span>
          <input type="date" disabled={disabled} value={range.to} min={range.from || undefined} max={today} onChange={(event) => changeCustom('to', event.target.value)} className={dateInputClass} />
        </label>
      </div>

      <p className={`text-xs ${tooLong || missing ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-600 dark:text-zinc-400'}`} role={tooLong ? 'alert' : undefined}>
        {missing
          ? 'Pick a start and an end date.'
          : tooLong
            ? `Ranges can cover up to ${MAX_RANGE_DAYS} days. Pick a shorter one, or review the period in parts.`
            : `${plural(days, 'day')}, ${formatDateKey(range.from, { withYear: true })} - ${formatDateKey(range.to, { withYear: true })}${tradeCount === null ? '' : `. ${plural(tradeCount, 'trade')} in this range.`}`}
      </p>
    </div>
  )
}

/**
 * One AI mentor review for any date range. Choosing dates only loads what is saved (free); a new review is written
 * when the trader presses the button. Needs at least 5 trades in the range; shares the 1-a-day / 3-a-week allowance
 * with the weekly review. Opening a range that was reviewed before shows that saved review again.
 * The allowance is one pool for both tabs: `quota` is the dialog's freshest copy of it (so a weekly review written a
 * moment ago locks this tab too), `onAccess` hands every response's allowance back to the dialog, `otherBusy` is true
 * while the weekly tab is writing, and `onBusyChange` tells the dialog when this tab is.
 */
function RangeReviewPanel({ journalId, currency, seed, journalRange, onOpenContext, quota = null, onAccess, otherBusy = false, onBusyChange }) {
  const [range, setRange] = useState(() => (seed?.from && seed?.to ? { preset: 'custom', from: seed.from, to: seed.to } : rangeFromPreset('30d')))
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'generating' | 'ready'
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const requestId = useRef(0)

  const days = range.from && range.to && range.from <= range.to ? daysBetween(range.from, range.to) : 0
  const valid = days > 0 && days <= MAX_RANGE_DAYS

  // changing the dates loads the saved review for that exact range (nothing is generated by picking dates)
  useEffect(() => {
    const id = ++requestId.current
    if (!valid) {
      setData(null)
      setPhase('idle')
      return undefined
    }
    setPhase('loading')
    setError('')
    setData(null)
    const timer = setTimeout(async () => {
      try {
        const next = await previewRangeReview(journalId, range.from, range.to)
        if (id !== requestId.current) return
        setData(next)
        onAccess?.(next.access)
      } catch (loadError) {
        if (id !== requestId.current) return
        setError(errorText(loadError))
      }
      if (id === requestId.current) setPhase('ready')
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onAccess only forwards the allowance and must not refetch
  }, [journalId, range.from, range.to, valid, reloadKey])

  useEffect(
    () => () => {
      requestId.current += 1
    },
    []
  )

  const generate = useCallback(async () => {
    const id = ++requestId.current
    setPhase('generating')
    setError('')
    try {
      const next = await createRangeReview(journalId, range.from, range.to)
      if (id !== requestId.current) return
      setData(next)
      onAccess?.(next.access)
    } catch (generateError) {
      if (id !== requestId.current) return
      setError(errorText(generateError))
    }
    if (id === requestId.current) setPhase('ready')
  }, [journalId, range.from, range.to, onAccess])

  // a long request can outlive the connection: while generating, keep checking whether the review has been saved
  useEffect(() => {
    if (phase !== 'generating') return undefined

    const id = requestId.current
    let cancelled = false
    let timeoutId
    const check = async () => {
      try {
        const latest = await previewRangeReview(journalId, range.from, range.to)
        if (cancelled || id !== requestId.current) return
        if (latest.review && !latest.stale) {
          setData(latest)
          onAccess?.(latest.access)
          setError('')
          setPhase('ready')
          return
        }
      } catch (pollError) {
        if (!cancelled && id === requestId.current) console.error('Could not check whether the AI review has completed:', pollError)
      }
      if (!cancelled) timeoutId = setTimeout(check, 4000)
    }
    timeoutId = setTimeout(check, 4000)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [phase, journalId, range.from, range.to, onAccess])

  const busy = phase === 'generating'
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  const review = data?.review ?? null
  const access = data?.access ?? null
  const lock = resolveLock(access, quota, otherBusy)
  const locked = lock.locked

  const renderBody = () => {
    if (!valid) return null
    if (phase === 'loading') return <ReviewSkeleton message="Opening this range..." />
    if (phase === 'generating') {
      const count = data?.tradeCount
      return <ReviewSkeleton message={`Reading your strategy and ${count ? plural(count, 'trade') : 'trades'}. A long range can take up to 30 seconds.`} />
    }

    if (!data && error) {
      return (
        <EmptyState
          title="The mentor couldn't finish"
          action={
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className={buttonPrimary}>
              Try again
            </button>
          }
        >
          {error}
        </EmptyState>
      )
    }
    if (!data) return null

    if (!data.hasStrategy) {
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

    if (data.tradeCount === 0) {
      return (
        <EmptyState title="No trades in this range">
          Nothing is logged between these dates. Pick a wider range, or one of the quick ranges above.
        </EmptyState>
      )
    }

    if (!review) {
      const notYetUnlocked = locked && lock.reason === 'not_enough_trades'
      return (
        <EmptyState
          title={notYetUnlocked ? 'Log a few more trades' : lock.reason === 'daily_limit' || lock.reason === 'weekly_limit' ? 'Come back for the next review' : 'Ready to review this range'}
          action={
            <button type="button" onClick={generate} disabled={locked} className={buttonPrimary}>
              Review {plural(data.tradeCount, 'trade')}
            </button>
          }
        >
          {locked
            ? lock.message
            : `${plural(data.tradeCount, 'trade')} over ${plural(data.days, 'day')}. The mentor compares them with your strategy${data.planner?.connected ? ', the plans in your connected planner' : ''} and looks for how your habits changed across the period.`}
        </EmptyState>
      )
    }

    return (
      <div className="space-y-7">
        {data.stats && <WeekStats week={data.stats} currency={currency} />}
        {data.stale && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-5 py-3.5 text-[13px] leading-6 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <span>
              Your trades, strategy or plans changed after this review was written.
              {locked && lock.message ? ` ${lock.message}` : ''}
            </span>
            {!locked && (
              <button type="button" onClick={generate} className="cursor-pointer font-medium underline-offset-2 hover:underline">
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ListenControls review={review} period="range" />
          {data.generatedAt && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Written {new Date(data.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <Review key={`${data.id ?? ''}-${data.generatedAt ?? ''}`} review={review} period="range" />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <RangePicker range={range} onChange={setRange} disabled={busy} journalRange={journalRange} tradeCount={data?.tradeCount ?? null} />
      {renderBody()}
    </div>
  )
}

export default RangeReviewPanel
