import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../utils/Icons.jsx'
import { addMonths, buildMonthGrid, formatMonthTitle, getWeekdayLabels, startOfMonth, todayKey } from '../../../utils/calendar'
import { focusRing, segmentedGroup } from '../../common/controlStyles'
import { toDateKey } from '../../../utils/tradeAnalytics'

const MAX_VISIBLE_CHIPS = 3

// "< Today >" is one joined h-8 group (same shape as the Trades | Analysis tabs), not three loose buttons
const navItem = `inline-flex h-full cursor-pointer items-center justify-center text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-50 dark:focus-visible:ring-sky-400`

const sideDot = {
  long: 'bg-emerald-600 dark:bg-emerald-400',
  short: 'bg-rose-600 dark:bg-rose-400'
}

/** Fixed h-6 pill, same shape as the planner chip. The dot shows the side; a spinner / red dot shows save state. */
function TradeChip({ trade, onOpen }) {
  const side = String(trade.side ?? trade.direction ?? '').toLowerCase()
  const isSaving = trade.syncState === 'saving'
  const isFailed = trade.syncState === 'failed'
  const label = `${trade.symbol || 'Trade'}${side ? ` \u00b7 ${side === 'long' ? 'Long' : 'Short'}` : ''}`

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(trade)
      }}
      title={isFailed ? `${label} (not saved)` : label}
      aria-busy={isSaving}
      className={`flex h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 px-2 text-left text-[11px] font-medium leading-none text-zinc-800 transition-colors hover:border-zinc-300 hover:bg-zinc-200 hover:text-zinc-900 dark:border-transparent dark:bg-white/[0.08] dark:text-zinc-200 dark:hover:border-transparent dark:hover:bg-white/[0.13] dark:hover:text-zinc-50 ${focusRing}`}
    >
      {isSaving ? (
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      ) : (
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${isFailed ? 'bg-amber-500' : sideDot[side] ?? 'bg-sky-700 dark:bg-sky-400'}`} />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

const moreButton =
  'h-5 cursor-pointer rounded px-2 text-[11px] font-medium text-zinc-700 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:ring-sky-400'

function DayCell({ day, trades, isToday, isSelected, isExpanded, onToggleExpand, onCreate, onOpenTrade }) {
  const visible = isExpanded ? trades : trades.slice(0, MAX_VISIBLE_CHIPS)
  const hiddenCount = trades.length - visible.length

  // States, in priority order. Selected = the day whose trade form is open in the drawer.
  //   selected      white tile, 2px sky ring, soft shadow
  //   today         number becomes a filled sky badge (so today and selected can be told apart, and can combine)
  //   other month   slightly tinted cell, same text colours (no opacity, so contrast is never reduced)
  const surface = isSelected
    ? 'bg-white shadow-card dark:bg-white/[0.08] dark:shadow-none'
    : day.inMonth
      ? 'hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.05]'
      : 'bg-zinc-900/[0.03] hover:bg-zinc-900/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]'

  return (
    <div
      onClick={() => onCreate(day.key)}
      data-selected={isSelected || undefined}
            className={`group relative flex min-h-[84px] min-w-0 cursor-pointer flex-col rounded-xl p-1.5 transition-colors sm:min-h-[116px] sm:p-2 ${surface}`}
    >
      <div className="flex h-6 items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCreate(day.key)
          }}
          aria-label={`Log a trade on ${day.key}`}
          aria-current={isToday ? 'date' : undefined}
          className={`flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums transition-colors ${focusRing} ${
            isToday
              ? 'bg-sky-700 text-white dark:bg-sky-400 dark:text-zinc-950'
              : day.inMonth
                ? 'text-zinc-800 hover:bg-zinc-900/[0.08] dark:text-zinc-200 dark:hover:bg-white/10'
                : 'text-zinc-600 hover:bg-zinc-900/[0.08] dark:text-zinc-400 dark:hover:bg-white/10'
          }`}
        >
          {day.day}
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-400" aria-hidden="true">
          <PlusIcon className="h-3 w-3" />
        </span>
      </div>

      <div className="mt-1.5 space-y-1">
        {visible.map((trade) => (
          <TradeChip key={trade.id} trade={trade} onOpen={onOpenTrade} />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpand(day.key)
            }}
            className={moreButton}
          >
            +{hiddenCount} more
          </button>
        )}
        {isExpanded && trades.length > MAX_VISIBLE_CHIPS && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpand(day.key)
            }}
            className={moreButton}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Month calendar for a journal, same template as the planner calendar.
 * Click a day (or its number) to log a trade on it, click a trade chip to open that trade.
 *
 * @param {Array}    trades          trades of the current journal
 * @param {string}   [selectedDate]  "YYYY-MM-DD" of the day whose form is open, highlighted in the grid
 * @param {Function} onCreateForDate (dateKey) => void
 * @param {Function} onOpenTrade     (trade) => void
 */
function JournalCalendar({ trades, selectedDate = null, onCreateForDate, onOpenTrade, headerHint }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [expandedDay, setExpandedDay] = useState(null)

  const days = useMemo(() => buildMonthGrid(month), [month])
  const weekdays = useMemo(() => getWeekdayLabels(), [])
  const today = todayKey()

  // oldest first inside a day, so the order matches the order the trades were taken
  const tradesByDate = useMemo(() => {
    const map = new Map()
    const ordered = [...trades].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
    for (const trade of ordered) {
      const key = toDateKey(trade.date)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(trade)
    }
    return map
  }, [trades])

  const goToMonth = (next) => {
    setExpandedDay(null)
    setMonth(next)
  }

  return (
    <section
      aria-label="Journal calendar"
      className="tc-surface rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-card sm:p-5 dark:border-zinc-800 dark:bg-white/[0.035] dark:shadow-none"
    >
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 aria-live="polite" className="text-lg font-semibold leading-8 tracking-tight text-zinc-900 dark:text-zinc-50">{formatMonthTitle(month)}</h2>
          {headerHint}
        </div>
        <div role="group" aria-label="Change month" className={segmentedGroup}>
          <button type="button" onClick={() => goToMonth(addMonths(month, -1))} aria-label="Previous month" title="Previous month" className={`${navItem} w-9`}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(startOfMonth(new Date()))}
            className={`${navItem} border-x border-zinc-300 px-3.5 dark:border-white/[0.14]`}
          >
            Today
          </button>
          <button type="button" onClick={() => goToMonth(addMonths(month, 1))} aria-label="Next month" title="Next month" className={`${navItem} w-9`}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weekdays.map((label) => (
          <div key={label} className="pb-2 text-center text-[11px] font-medium uppercase leading-4 tracking-wider text-zinc-600 dark:text-zinc-400">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.key}
            day={day}
            trades={tradesByDate.get(day.key) ?? []}
            isToday={day.key === today}
            isSelected={day.key === selectedDate}
            isExpanded={expandedDay === day.key}
            onToggleExpand={(key) => setExpandedDay((current) => (current === key ? null : key))}
            onCreate={onCreateForDate}
            onOpenTrade={onOpenTrade}
          />
        ))}
      </div>
    </section>
  )
}

export default JournalCalendar
