import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../../utils/Icons.jsx'
import { addMonths, buildMonthGrid, formatMonthTitle, getWeekdayLabels, startOfMonth, todayKey } from '../../../utils/calendar'

const MAX_VISIBLE_CHIPS = 3

const navButton =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100'

function EntryChip({ entry, onOpen }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(entry)
      }}
      title={entry.title}
      className="flex w-full cursor-pointer items-center gap-2 truncate rounded px-2 py-1 text-left text-[10px] leading-[14px] text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 focus:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 dark:focus:bg-white/[0.07]"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" />
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
      className={`group relative min-h-[72px] cursor-pointer p-[5px] transition-colors sm:min-h-[99px] ${
        day.inMonth
          ? 'bg-white hover:bg-zinc-50 dark:bg-[#191919] dark:hover:bg-white/[0.03]'
          : 'bg-zinc-50/70 hover:bg-zinc-50 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onCreate(day.key)
          }}
          aria-label={`Plan for ${day.key}`}
          className={`flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full px-1 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 ${
            isToday
              ? 'bg-sky-500 text-white'
              : day.inMonth
                ? 'text-zinc-700 dark:text-zinc-300'
                : 'text-zinc-400 dark:text-zinc-600'
          }`}
        >
          {day.day}
        </button>
        <span className="flex h-4 w-4 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500" aria-hidden="true">
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
    <section aria-label="Planner calendar">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <h2 className="text-[17px] font-semibold tracking-[-0.05em]">{formatMonthTitle(month)}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => goToMonth(addMonths(month, -1))} aria-label="Previous month" title="Previous month" className={navButton}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(startOfMonth(new Date()))}
            className="h-7 cursor-pointer rounded-md border border-zinc-200 px-2.5 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            Today
          </button>
          <button type="button" onClick={() => goToMonth(addMonths(month, 1))} aria-label="Next month" title="Next month" className={navButton}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10">
        <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-white/10">
          {weekdays.map((label) => (
            <div key={label} className="bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-[#202020] dark:text-zinc-400">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-white/10">
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
      </div>
    </section>
  )
}

export default PlannerCalendar
