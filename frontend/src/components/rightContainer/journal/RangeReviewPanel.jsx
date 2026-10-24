import { useCallback, useEffect, useRef, useState } from 'react'
import { createRangeReview, previewRangeReview } from '../../../services/aiRangeReviewApi'
import { dateKeyFromDate, formatDateKey } from '../../../utils/tradeAnalytics'
import { focusRing } from '../../common/controlStyles'
import ListenControls from './ListenControls'
import MentorLoader from './MentorLoader'
import { Review } from './ReviewReport'
import ReviewDownloadButton from './ReviewDownloadButton'
import { EmptyState, ReviewSkeleton, allowanceText, buttonPrimary, buttonQuiet, errorText, mondayOf, resolveLock, shiftDays } from './reviewParts'

// Longest range one review may cover: five years plus a few days of slack. The server enforces the same limit
// (AI_RANGE_MAX_DAYS, default 1830).
export const MAX_RANGE_DAYS = 1830
const MAX_RANGE_YEARS = Math.floor(MAX_RANGE_DAYS / 365)

const dateInputClass =
  'h-9 w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 text-xs text-zinc-800 outline-none transition-colors [color-scheme:light] focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 dark:border-white/[0.14] dark:text-zinc-100 dark:[color-scheme:dark]'

const todayKey = () => dateKeyFromDate(new Date())
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000) + 1
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Oldest start a review may use: the longest allowed range ending today. */
const oldestAllowed = (today) => shiftDays(today, -(MAX_RANGE_DAYS - 1))

// One picker for every kind of period. Weekly is just a preset now. Every range ends today at the latest.
const PRESETS = [
  { id: 'week', label: 'This week', resolve: (today) => ({ from: mondayOf(today), to: today }) },
  { id: 'last-week', label: 'Last week', resolve: (today) => ({ from: shiftDays(mondayOf(today), -7), to: shiftDays(mondayOf(today), -1) }) },
  {
    id: 'month',
    label: 'This month',
    resolve: (today) => ({ from: `${today.slice(0, 7)}-01`, to: today })
  },
  { id: '30d', label: 'Last 30 days', resolve: (today) => ({ from: shiftDays(today, -29), to: today }) },
  {
    id: 'all',
    label: 'All trades',
    // from the journal's first trade, but never further back than one review may cover
    resolve: (today, earliest) => {
      const floor = oldestAllowed(today)
      return { from: earliest && earliest > floor ? earliest : floor, to: today }
    }
  }
]

const rangeFromPreset = (id, earliest) => ({ preset: id, ...PRESETS.find((item) => item.id === id).resolve(todayKey(), earliest) })

const chip = (active) =>
  `h-8 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${
    active
      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
      : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.14] dark:text-zinc-300 dark:hover:bg-white/[0.07]'
  }`

/** Preset chips, plus two date fields only when "Custom" is picked. */
function RangePicker({ range, onChange, disabled, earliestTradeDate, summary, showWorkHint }) {
  const today = todayKey()
  const custom = range.preset === 'custom'
  const days = range.from && range.to && range.from <= range.to ? daysBetween(range.from, range.to) : 0
  const tooLong = days > MAX_RANGE_DAYS

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
    <div className="space-y-3.5">
      <div role="group" aria-label="Period to review" className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button key={preset.id} type="button" disabled={disabled} aria-pressed={range.preset === preset.id} onClick={() => onChange(rangeFromPreset(preset.id, earliestTradeDate))} className={chip(range.preset === preset.id)}>
            {preset.label}
          </button>
        ))}
        <button type="button" disabled={disabled} aria-pressed={custom} onClick={() => onChange({ ...range, preset: 'custom' })} className={chip(custom)}>
          Custom
        </button>
      </div>

      {custom && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] text-zinc-500 dark:text-zinc-400">From</span>
            <input type="date" disabled={disabled} value={range.from} max={range.to || today} onChange={(event) => changeCustom('from', event.target.value)} className={dateInputClass} />
          </label>
          <label className="min-w-0">
            <span className="mb-1.5 block text-[11px] text-zinc-500 dark:text-zinc-400">To</span>
            <input type="date" disabled={disabled} value={range.to} min={range.from || undefined} max={today} onChange={(event) => changeCustom('to', event.target.value)} className={dateInputClass} />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={`text-xs ${tooLong || !days ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-500 dark:text-zinc-400'}`} role={tooLong ? 'alert' : undefined}>
          {!range.from || !range.to
            ? 'Pick a start and an end date.'
            : tooLong
              ? `A review can cover up to ${MAX_RANGE_YEARS} years. Pick a shorter range.`
              : `${formatDateKey(range.from, { withYear: true })} - ${formatDateKey(range.to, { withYear: true })}${summary ? ` · ${summary}` : ''}`}
        </p>
        {showWorkHint && <p className="ml-auto text-[10px] text-zinc-600 dark:text-zinc-300">Keep working while this loads.</p>}
      </div>
    </div>
  )
}

/** Five small segments filling as the range gains trades: how close the review is to unlocking. */
function UnlockMeter({ count, target }) {
  return (
    <span className="flex items-center justify-center gap-1.5" role="img" aria-label={`${count} of ${target} trades in this range`}>
      {Array.from({ length: target }, (_, index) => (
        <span key={index} className={`h-1.5 w-8 rounded-full transition-colors ${index < count ? 'bg-[#c4623f] dark:bg-[#e08a68]' : 'bg-zinc-200 dark:bg-white/[0.12]'}`} />
      ))}
    </span>
  )
}

/**
 * The only way to ask the mentor for feedback: pick a period (a preset or any dates), then press the button.
 * Choosing dates only loads what is saved (free); a new review is written when the trader presses the button.
 * It needs at least 5 trades in the range and draws on the trader's 1-a-day / 3-a-week allowance.
 * `quota` is the dialog's freshest copy of the allowance, `onAccess` hands every response's allowance back to the dialog,
 * and `onBusyChange` tells the dialog while a review is being written.
 */
function RangeReviewPanel({ journalId, currency, seed, journalRange, earliestTradeDate, onOpenContext, onAddTrade, quota = null, onAccess, onBusyChange, onRefreshQuota, onReviewReady }) {
  const [range, setRange] = useState(() => {
    const today = todayKey()
    if (seed?.from && seed?.to) return { preset: 'custom', from: seed.from < oldestAllowed(today) ? oldestAllowed(today) : seed.from, to: seed.to > today ? today : seed.to }
    if (journalRange?.from && journalRange?.to) return { preset: 'custom', from: journalRange.from, to: journalRange.to > today ? today : journalRange.to }
    return rangeFromPreset('all', earliestTradeDate)
  })
  const [data, setData] = useState(null)
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'generating' | 'ready'
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const requestId = useRef(0)

  const days = range.from && range.to && range.from <= range.to ? daysBetween(range.from, range.to) : 0
  const valid = days > 0 && days <= MAX_RANGE_DAYS

  const changeRange = useCallback((next) => {
    requestId.current += 1
    setRange(next)
    setData(null)
    setPhase('idle')
    setError('')
  }, [])

  // changing the dates loads the saved review for that exact range (nothing is generated by picking dates)
  useEffect(() => {
    const id = ++requestId.current
    if (!valid) return undefined
    const timer = setTimeout(async () => {
      setPhase('loading')
      setError('')
      setData(null)
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
      if (next.review && !next.stale) onReviewReady?.()
    } catch (generateError) {
      if (id !== requestId.current) return
      setError(errorText(generateError))
      onRefreshQuota?.()
    }
    if (id === requestId.current) setPhase('ready')
  }, [journalId, range.from, range.to, onAccess, onRefreshQuota, onReviewReady])

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
          onReviewReady?.()
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
  }, [phase, journalId, range.from, range.to, onAccess, onReviewReady])

  const busy = valid && phase === 'generating'
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  const review = data?.review ?? null
  const access = data?.access ?? null
  const lock = resolveLock(access, quota, false)
  const locked = lock.locked
  const allowance = allowanceText(quota?.usage ?? access?.usage)

  const renderBody = () => {
    if (!valid) return null
    if (phase === 'loading') return <ReviewSkeleton message="Opening this period..." />
    if (phase === 'generating') {
      const count = data?.tradeCount
      return <MentorLoader tradeCount={count} />
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

    // a saved review is shown even when the range has since dropped below the minimum
    if (!review && data.access?.reason === 'not_enough_trades') {
      const target = data.access.threshold ?? 5
      const have = Math.min(data.tradeCount, target)
      const remaining = Math.max(target - data.tradeCount, 0)
      return (
        <EmptyState
          title={data.tradeCount === 0 ? 'No trades in this period' : `${plural(remaining, 'more trade')} to unlock`}
          action={
            <>
              {range.preset !== 'all' && (
                <button type="button" onClick={() => changeRange(rangeFromPreset('all', earliestTradeDate))} className={buttonQuiet}>
                  Use all trades
                </button>
              )}
              {onAddTrade && (
                <button type="button" onClick={onAddTrade} className={buttonPrimary}>
                  Log a trade
                </button>
              )}
            </>
          }
        >
          <span className="mb-5 block"><UnlockMeter count={have} target={target} /></span>
          A review needs at least {target} trades in the period you pick, so the mentor can see patterns instead of guessing. You have {data.tradeCount} here.
        </EmptyState>
      )
    }

    if (!review) {
      const capped = locked && (lock.reason === 'daily_limit' || lock.reason === 'weekly_limit')
      return (
        <EmptyState
          title={capped ? 'Come back for the next review' : `Ready to review ${plural(data.tradeCount, 'trade')}`}
          action={
            <button type="button" onClick={generate} disabled={locked} className={buttonPrimary}>
              Write my review
            </button>
          }
        >
          {locked
            ? lock.message
            : `Over ${plural(data.days, 'day')}. The mentor checks your trades against your strategy${data.planner?.connected ? ', the plans in your connected planner' : ''} and looks at how your habits changed.`}
          {!locked && allowance && <span className="mt-3 block text-xs text-zinc-500 dark:text-zinc-400">This uses one review once it is delivered. {allowance}.</span>}
          {error && (
            <span role="alert" className="mt-5 block rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-[13px] leading-6 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
              {error}
            </span>
          )}
        </EmptyState>
      )
    }

    return (
      <div className="space-y-7">
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
          <ListenControls review={review} period="range" currency={currency} />
          <div className="flex items-center gap-1">
            {data.generatedAt && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Written {new Date(data.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <ReviewDownloadButton review={review} period="range" from={range.from} to={range.to} generatedAt={data.generatedAt} stats={data.stats} currency={currency} />
          </div>
        </div>
        <Review key={`${data.id ?? ''}-${data.generatedAt ?? ''}`} review={review} period="range" stats={data.stats} currency={currency} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <RangePicker range={range} onChange={changeRange} disabled={busy} earliestTradeDate={earliestTradeDate} summary={data ? plural(data.tradeCount, 'trade') : ''} showWorkHint={busy} />
      {renderBody()}
    </div>
  )
}

export default RangeReviewPanel
