import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../utils/Icons.jsx'
import { addMonths, buildMonthGrid, formatMonthTitle, getWeekdayLabels, startOfMonth, todayKey } from '../../../utils/calendar'
import { focusRing, segmentedGroup } from '../../common/controlStyles'

const MAX_VISIBLE_CHIPS = 3

// "< Today >" is one joined h-8 group (same shape as the Trades | Analysis tabs), not three loose buttons
const navItem = `inline-flex h-full cursor-pointer items-center justify-center text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-50 dark:focus-visible:ring-sky-400`

/** Fixed h-6 pill: the label is truncated inside it, so it can never grow taller than the cell or clip a descender. */
function EntryChip({ entry, onOpen }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(entry)
      }}
      title={entry.title}
      className={`flex h-6 w-full min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md bg-zinc-900/[0.06] px-2 text-left text-[11px] font-medium leading-none text-zinc-800 transition-colors hover:bg-zinc-900/[0.1] hover:text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-200 dark:hover:bg-white/[0.13] dark:hover:text-zinc-50 ${focusRing}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-700 dark:bg-sky-400" />
      <span className="min-w-0 flex-1 truncate">{entry.title}</span>
    </button>
  )
}

const moreButton =
  'h-5 cursor-pointer rounded px-2 text-[11px] font-medium text-zinc-700 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:ring-sky-400'

function DayCell({ day, entries, isToday, isSelected, isExpanded, onToggleExpand, onCreate, onOpenEntry }) {
  const visible = isExpanded ? entries : entries.slice(0, MAX_VISIBLE_CHIPS)
  const hiddenCount = entries.length - visible.length

  // States, in priority order. Selected = the day whose plan is open in the drawer.
  //   selected      white tile, 2px sky ring, soft shadow
  //   today         number becomes a filled sky badge (so today and selected can be told apart, and can combine)
  //   other month   slightly tinted cell, same text colours (no opacity, so contrast is never reduced)
  const surface = isSelected
    ? 'bg-white shadow-card ring-2 ring-sky-700 dark:bg-white/[0.08] dark:shadow-none dark:ring-sky-400'
    : day.inMonth
      ? 'hover:bg-zinc-900/[0.05] dark:hover:bg-white/[0.05]'
      : 'bg-zinc-900/[0.03] hover:bg-zinc-900/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.05]'

  return (
    <div
      onClick={() => onCreate(day.key)}
      data-selected={isSelected || undefined}
      data-tour={isToday ? 'planner-today' : undefined}
      className={`group relative flex min-h-[84px] min-w-0 cursor-pointer flex-col rounded-xl p-1.5 transition-colors sm:min-h-[116px] sm:p-2 ${surface}`}
    >
      <div className="flex h-6 items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCreate(day.key)
          }}
          aria-label={`Plan for ${day.key}`}
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
        {visible.map((entry) => (
          <EntryChip key={entry.id} entry={entry} onOpen={onOpenEntry} />
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
        {isExpanded && entries.length > MAX_VISIBLE_CHIPS && (
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
 * Notion-style month calendar. Click a day (or its number) to plan for it,
 * click a plan chip to open it.
 *
 * @param {Array}    entries         plans of the current planner
 * @param {string}   [selectedDate]  "YYYY-MM-DD" of the day whose plan is open, highlighted in the grid
 * @param {Function} onCreateForDate (dateKey) => void
 * @param {Function} onOpenEntry     (entry) => void
 */
function PlannerCalendar({ entries, selectedDate = null, onCreateForDate, onOpenEntry }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [expandedDay, setExpandedDay] = useState(null)

  const days = useMemo(() => buildMonthGrid(month), [month])
  const weekdays = useMemo(() => getWeekdayLabels(), [])
  const today = todayKey()

  const entriesByDate = useMemo(() => {
    const map = new Map()
    for (const entry of entries) {
      if (!map.has(entry.date)) map.set(entry.date, [])
      map.get(entry.date).push(entry)
    }
    return map
  }, [entries])

  const goToMonth = (next) => {
    setExpandedDay(null)
    setMonth(next)
  }

  return (
    <section
      aria-label="Planner calendar"
      className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-card sm:p-5 dark:border-zinc-800 dark:bg-white/[0.035] dark:shadow-none"
    >
      <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h2 aria-live="polite" className="text-lg font-semibold leading-8 tracking-tight text-zinc-900 dark:text-zinc-50">{formatMonthTitle(month)}</h2>
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
          // zinc-600 on the card = 7:1, zinc-400 on dark = 6.9:1 (the old zinc-400 / zinc-500 were 2.3:1 and 3.6:1)
          <div key={label} className="pb-2 text-center text-[11px] font-medium uppercase leading-4 tracking-wider text-zinc-600 dark:text-zinc-400">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.key}
            day={day}
            entries={entriesByDate.get(day.key) ?? []}
            isToday={day.key === today}
            isSelected={day.key === selectedDate}
            isExpanded={expandedDay === day.key}
            onToggleExpand={(key) => setExpandedDay((current) => (current === key ? null : key))}
            onCreate={onCreateForDate}
            onOpenEntry={onOpenEntry}
          />
        ))}
      </div>
    </section>
  )
}

export default PlannerCalendar
