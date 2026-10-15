import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '../../../utils/Icons.jsx'
import { getAiReview } from '../../../services/aiReviewApi'
import { getRangeReview, listReviewHistory } from '../../../services/aiRangeReviewApi'
import { formatDateKey, formatMoney, toneOf } from '../../../utils/tradeAnalytics'
import { focusRing } from '../../common/controlStyles'
import ListenControls from './ListenControls'
import { DISCIPLINE, EmptyState, Pill, Review, ReviewSkeleton, WeekStats, buttonPrimary, buttonQuiet, errorText, moneyTone } from './reviewParts'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'week', label: 'Weekly' },
  { id: 'range', label: 'Date range' }
]

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
const rangeLabel = (item) => `${formatDateKey(item.start)} - ${formatDateKey(item.end)}`
const writtenAt = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function KindBadge({ item }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-zinc-100 px-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
      {item.kind === 'range' ? 'Range' : 'Week'}
    </span>
  )
}

function HistoryRow({ item, currency, onOpen }) {
  const discipline = DISCIPLINE[item.discipline.verdict] ?? DISCIPLINE.cannot_assess
  const stats = item.stats
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full cursor-pointer flex-col items-start gap-1.5 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${focusRing}`}
    >
      <span className="flex w-full items-center gap-2">
        <KindBadge item={item} />
        <span className="text-xs font-medium tabular-nums text-zinc-800 dark:text-zinc-200">{rangeLabel(item)}</span>
        <ChevronRightIcon className="ml-auto h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
      </span>
      <span className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.headline || 'Mentor review'}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Pill tone={discipline.tone}>
          {discipline.label}
          {item.discipline.score !== null ? ` ${item.discipline.score}%` : ''}
        </Pill>
        <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{plural(item.tradeCount, 'trade')}</span>
        {stats?.closed > 0 && (
          <span className={`text-xs font-medium tabular-nums ${moneyTone[toneOf(stats.netPnl)]}`}>{formatMoney(stats.netPnl, { currency, signed: true })}</span>
        )}
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Written {writtenAt(item.generatedAt)}</span>
      </span>
    </button>
  )
}

/**
 * Every past mentor review of this journal, weekly and date-range together, newest first. Browsing is free: it only
 * reads what is saved. Open one, then step to older or newer feedback without going back to the list.
 * `onUpdate(item)` hands a stale review back to the dialog so it can be refreshed in its own tab.
 */
function ReviewHistoryPanel({ journalId, currency, onUpdate }) {
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [nextBefore, setNextBefore] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all')

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState({ phase: 'idle', data: null, error: '' })
  const detailRequest = useRef(0)

  const visible = useMemo(() => items.filter((item) => filter === 'all' || item.kind === filter), [items, filter])
  const index = visible.findIndex((item) => `${item.kind}:${item.id}` === selectedId)
  const selected = index >= 0 ? visible[index] : null

  const loadFirst = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const page = await listReviewHistory(journalId)
      setItems(page.items)
      setHasMore(page.hasMore)
      setNextBefore(page.nextBefore)
      setStatus('ready')
    } catch (loadError) {
      setError(errorText(loadError))
      setStatus('error')
    }
  }, [journalId])

  useEffect(() => {
    loadFirst()
    return () => {
      detailRequest.current += 1
    }
  }, [loadFirst])

  /** Loads the next page of the history. Resolves to the items it added (an empty list when it failed). */
  const loadMore = async () => {
    if (!hasMore || loadingMore) return []
    setLoadingMore(true)
    try {
      const page = await listReviewHistory(journalId, { before: nextBefore })
      setItems((current) => [...current, ...page.items])
      setHasMore(page.hasMore)
      setNextBefore(page.nextBefore)
      return page.items
    } catch (loadError) {
      setError(errorText(loadError))
      return []
    } finally {
      setLoadingMore(false)
    }
  }

  const openItem = async (item) => {
    const id = ++detailRequest.current
    setSelectedId(`${item.kind}:${item.id}`)
    setDetail({ phase: 'loading', data: null, error: '' })
    try {
      const data = item.kind === 'range' ? await getRangeReview(journalId, item.id) : await getAiReview(journalId, item.start)
      if (id !== detailRequest.current) return
      setDetail({ phase: 'ready', data, error: '' })
    } catch (openError) {
      if (id !== detailRequest.current) return
      setDetail({ phase: 'ready', data: null, error: errorText(openError) })
    }
  }

  const closeItem = () => {
    detailRequest.current += 1
    setSelectedId(null)
    setDetail({ phase: 'idle', data: null, error: '' })
  }

  // the list is newest first, so "older" is further down the list
  const goOlder = async () => {
    if (index + 1 < visible.length) return openItem(visible[index + 1])
    if (!hasMore) return undefined
    const added = (await loadMore()).filter((item) => filter === 'all' || item.kind === filter)
    return added.length ? openItem(added[0]) : undefined
  }
  const goNewer = () => (index > 0 ? openItem(visible[index - 1]) : undefined)

  if (status === 'loading') return <ReviewSkeleton message="Opening your past feedback..." />

  if (status === 'error') {
    return (
      <EmptyState
        title="Couldn't load your feedback"
        action={
          <button type="button" onClick={loadFirst} className={buttonPrimary}>
            Try again
          </button>
        }
      >
        {error}
      </EmptyState>
    )
  }

  if (!items.length) {
    return <EmptyState title="No feedback yet">Your mentor reviews will be saved here, weekly and date-range ones together, so you can look back at how your trading changed.</EmptyState>
  }

  if (selected) {
    const { data } = detail
    const stats = data?.kind === 'range' ? data.stats : data?.week
    const period = selected.kind === 'range' ? 'range' : 'week'
    const olderDisabled = index + 1 >= visible.length && !hasMore
    const navButton = `flex h-8 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 text-xs font-medium text-zinc-700 transition-colors enabled:cursor-pointer enabled:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.14] dark:text-zinc-200 dark:enabled:hover:bg-white/[0.07] ${focusRing}`

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={closeItem} className={`${navButton} cursor-pointer`}>
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            All feedback
          </button>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={goOlder} disabled={olderDisabled || loadingMore} aria-label="Older feedback" className={navButton}>
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Older
            </button>
            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
              {index + 1} of {visible.length}
              {hasMore ? '+' : ''}
            </span>
            <button type="button" onClick={goNewer} disabled={index <= 0} aria-label="Newer feedback" className={navButton}>
              Newer
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <KindBadge item={selected} />
          <span className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{rangeLabel(selected)}</span>
        </div>

        {detail.phase === 'loading' && <ReviewSkeleton message="Opening this review..." />}

        {detail.phase === 'ready' && !data && (
          <EmptyState
            title="Couldn't open this review"
            action={
              <button type="button" onClick={() => openItem(selected)} className={buttonPrimary}>
                Try again
              </button>
            }
          >
            {detail.error}
          </EmptyState>
        )}

        {detail.phase === 'ready' && data && !data.review && <EmptyState title="This review is no longer saved">Open the Weekly or Date range tab to write a new one.</EmptyState>}

        {detail.phase === 'ready' && data?.review && (
          <div className="space-y-6">
            {stats && <WeekStats week={stats} currency={currency} />}
            {data.stale && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                <span>Your trades, strategy or plans changed after this review was written.</span>
                <button type="button" onClick={() => onUpdate(selected)} className="cursor-pointer font-medium underline-offset-2 hover:underline">
                  Open to update
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ListenControls review={data.review} period={period} />
              {data.generatedAt && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Written {writtenAt(data.generatedAt)}</span>}
            </div>
            <Review key={`${selected.kind}:${selected.id}:${data.generatedAt ?? ''}`} review={data.review} period={period} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter feedback" className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => {
          const active = filter === item.id
          const count = item.id === 'all' ? items.length : items.filter((entry) => entry.kind === item.id).length
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

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {visible.length ? (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-white/[0.08] dark:border-white/[0.08]">
          {visible.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <HistoryRow item={item} currency={currency} onOpen={() => openItem(item)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">No {filter === 'week' ? 'weekly' : 'date-range'} feedback loaded yet.</p>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className={buttonQuiet}>
            {loadingMore ? 'Loading...' : 'Load older feedback'}
          </button>
        </div>
      )}
    </div>
  )
}

export default ReviewHistoryPanel
