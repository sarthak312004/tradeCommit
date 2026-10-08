import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../utils/Icons.jsx'
import { addMonths, buildMonthGrid, formatMonthTitle, getWeekdayLabels, startOfMonth, todayKey } from '../../../utils/calendar'

const MAX_VISIBLE_CHIPS = 3

const ring = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

// round, bordered buttons like the calendar card on the landing page
const navButton = `flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-zinc-300/70 text-zinc-500 transition-colors hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:border-white/[0.1] dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${ring}`

function EntryChip({ entry, onOpen }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(entry)
      }}
      title={entry.title}
      className={`flex w-full cursor-pointer items-center gap-1.5 truncate rounded-lg bg-zinc-900/[0.05] px-2 py-1 text-left text-[10px] leading-[14px] text-zinc-700 transition-colors hover:bg-zinc-900/[0.09] hover:text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1] dark:hover:text-zinc-100 ${ring}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
      <span className="truncate">{entry.title}</span>
    </button>
  )
}

function DayCell({ day, entries, isToday, isExpanded, onToggleExpand, onCreate, onOpenEntry }) {
  const visible = isExpanded ? entries : entries.slice(0, MAX_VISIBLE_CHIPS)
  const hiddenCount = entries.length - visible.length

  return (
    <div
      onClick={() => onCreate(day.key)}
      className={`group relative min-h-[72px] cursor-pointer rounded-xl p-1.5 transition-colors sm:min-h-[99px] sm:p-2 ${
        isToday ? 'bg-zinc-900/[0.04] dark:bg-white/[0.05]' : 'hover:bg-zinc-900/[0.04] dark:hover:bg-white/[0.04]'
      } ${day.inMonth ? '' : 'opacity-50'}`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCreate(day.key)
          }}
          aria-label={`Plan for ${day.key}`}
          className={`flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-lg px-1.5 text-[11px] font-medium ${ring} ${
            isToday ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-300'
          }`}
        >
          {day.day}
        </button>
        <span className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-400" aria-hidden="true">
          <PlusIcon className="h-3 w-3" />
        </span>
      </div>

      <div className="mt-2 space-y-1">
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
            className="cursor-pointer px-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
            className="cursor-pointer px-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
 * @param {Function} onCreateForDate (dateKey) => void
 * @param {Function} onOpenEntry     (entry) => void
 */
function PlannerCalendar({ entries, onCreateForDate, onOpenEntry }) {
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
      className="rounded-[24px] border border-zinc-300/60 bg-white/65 p-4 shadow-[0_30px_80px_-55px_rgba(24,24,27,0.5)] sm:p-5 dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-[17px] font-medium tracking-[-0.02em] text-zinc-900 dark:text-zinc-50">{formatMonthTitle(month)}</h2>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => goToMonth(addMonths(month, -1))} aria-label="Previous month" title="Previous month" className={navButton}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(startOfMonth(new Date()))}
            className={`h-8 cursor-pointer rounded-full border border-zinc-300/70 px-3.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:border-white/[0.1] dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 ${ring}`}
          >
            Today
          </button>
          <button type="button" onClick={() => goToMonth(addMonths(month, 1))} aria-label="Next month" title="Next month" className={navButton}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weekdays.map((label) => (
          <div key={label} className="pb-2 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={day.key}
            day={day}
            entries={entriesByDate.get(day.key) ?? []}
            isToday={day.key === today}
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
