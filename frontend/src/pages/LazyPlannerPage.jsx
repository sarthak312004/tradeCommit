import { lazy, Suspense, useContext } from 'react'
import { useParams } from 'react-router'
import { plannerContext } from '../context/Context'
import TopBar from '../components/rightContainer/TopBar'
import { buildMonthGrid, formatMonthTitle, getWeekdayLabels, startOfMonth } from '../utils/calendar'
import { preloadPlannerPage } from '../utils/plannerPageLoader'

const PlannerPage = lazy(preloadPlannerPage)

const pageBody = 'subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 md:p-8'

function PlannerLoading({ planner }) {
  const month = startOfMonth(new Date())
  const weekdays = getWeekdayLabels()
  const days = buildMonthGrid(month)

  return (
    <>
      <TopBar
        label={planner ? `Trade planner · ${planner.type}` : 'Trade planner'}
        title={planner?.name ?? 'Loading planner…'}
      />
      <div aria-busy="true" className={pageBody}>
        <div className="mb-4 flex min-h-8 flex-wrap items-center gap-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-zinc-100 dark:bg-white/[0.04]" />
          <div className="h-8 w-44 animate-pulse rounded-full bg-zinc-100 dark:bg-white/[0.04]" />
        </div>
        <section
          aria-label="Planner calendar"
          className="rounded-2xl border border-zinc-200 bg-white/70 p-4 shadow-card dark:border-zinc-800 dark:bg-white/[0.035] dark:shadow-none sm:p-5"
        >
          <div className="mb-4 flex min-h-8 flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold leading-8 tracking-tight text-zinc-900 dark:text-zinc-50">{formatMonthTitle(month)}</h2>
            <div className="h-8 w-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-white/[0.05]" />
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {weekdays.map((weekday) => (
              <div key={weekday} className="pb-2 text-center text-[11px] font-medium uppercase leading-4 tracking-wider text-zinc-600 dark:text-zinc-400">
                {weekday}
              </div>
            ))}
            {days.map((day) => (
              <div
                key={day.key}
                className="min-h-[84px] animate-pulse rounded-xl bg-zinc-100/80 p-1.5 dark:bg-white/[0.035] sm:min-h-[116px] sm:p-2"
              >
                <div className="h-6 w-6 rounded-full bg-zinc-200/80 dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </section>
        <span className="sr-only">Loading planner…</span>
      </div>
    </>
  )
}

function LazyPlannerPage() {
  const { plannerId } = useParams()
  const { planners } = useContext(plannerContext)
  const planner = planners.find((item) => item.id === plannerId)

  return (
    <Suspense fallback={<PlannerLoading planner={planner} />}>
      <PlannerPage />
    </Suspense>
  )
}

export default LazyPlannerPage
