import { lazy, Suspense, useContext, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { plannerContext } from '../context/Context'
import { usePlanEntries } from '../hooks/usePlanEntries'
import TopBar from '../components/rightContainer/TopBar'
import PlannerCalendar from '../components/rightContainer/planner/PlannerCalendar'
import PlannerJournalLink from '../components/rightContainer/planner/PlannerJournalLink'
import ScrollFade from '../components/common/ScrollFade'
import { todayKey } from '../utils/calendar'
import { CalendarIcon } from '../utils/Icons.jsx'
import { loadPlanForm, preloadPlanForm } from '../utils/formLoaders'
import { getCarryForward } from '../services/aiRangeReviewApi'

const pageBody = 'subtle-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-6 md:p-8'
const PlanForm = lazy(loadPlanForm)

function PlannerWorkspace({ planner }) {
  const { entries, isLoading, error, addEntry, updateEntry, removeEntry, uploadImage } = usePlanEntries(planner.id)
  // null = drawer closed, { entry: null, date } = new plan, { entry } = editing
  const [formState, setFormState] = useState(null)
  // the change the linked journal's latest mentor review asked for: shown inside the plan form so feedback reaches the next plan
  const [carryForward, setCarryForward] = useState(null)
  const linkedJournalId = planner.linkedJournalId
  useEffect(() => {
    if (!linkedJournalId) return undefined
    let cancelled = false
    getCarryForward(linkedJournalId)
      .then((response) => { if (!cancelled) setCarryForward(response?.commitment ?? null) })
      .catch((error) => {
        if (!cancelled) console.error('Could not load the mentor carry-forward hint:', error)
      })
    return () => { cancelled = true }
  }, [linkedJournalId, formState])

  // Start loading the form as soon as the planner is mounted, so an immediate first click is ready.
  useEffect(() => {
    preloadPlanForm()
  }, [])

  const handleSubmit = (values, prepare) =>
    formState.entry ? updateEntry(formState.entry.id, values, prepare) : addEntry(values, prepare)

  return (
    <>
      <TopBar label={`Trade planner · ${planner.type}`} title={planner.name} />
      <ScrollFade className="flex min-h-0 flex-1 flex-col" scrollClassName={pageBody}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <PlannerJournalLink planner={planner} />
        </div>
        {error && <p role="alert" className="mb-4 text-sm text-rose-500">{error}</p>}
        {isLoading && <p role="status" className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Loading plans…</p>}
        <PlannerCalendar
          entries={entries}
          selectedDate={formState?.entry?.date ?? formState?.date ?? null}
          onCreateForDate={(date) => setFormState({ entry: null, date })}
          onOpenEntry={(entry) => setFormState({ entry })}
          headerHint={!isLoading && (
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-zinc-200 bg-white/80 py-1 pl-2.5 pr-1 text-xs text-zinc-600 shadow-sm dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-zinc-300">
              <CalendarIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>Click a date to plan</span>
              <button
                type="button"
                onClick={() => setFormState({ entry: null, date: todayKey() })}
                onPointerEnter={preloadPlanForm}
                onFocus={preloadPlanForm}
                className="shrink-0 rounded-full bg-sky-600/10 px-2 py-1 font-medium text-sky-800 transition-colors hover:bg-sky-600/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:bg-sky-400/10 dark:text-sky-300 dark:hover:bg-sky-400/15 dark:focus-visible:ring-sky-400"
              >
                Plan today
              </button>
            </div>
          )}
        />
      </ScrollFade>

      {formState && (
        <Suspense fallback={null}>
          <PlanForm
            key={formState.entry?.id ?? `new-${formState.date}`}
            plannerName={planner.name}
            plannerType={planner.type}
            initialEntry={formState.entry}
            initialDate={formState.date}
            onSubmit={handleSubmit}
            onDelete={formState.entry ? () => removeEntry(formState.entry.id) : undefined}
            onClose={() => setFormState(null)}
            onUploadImage={uploadImage}
            carryForward={linkedJournalId ? carryForward : null}
          />
        </Suspense>
      )}
    </>
  )
}

function PlannerPage() {
  const { plannerId } = useParams()
  const { planners, isLoading } = useContext(plannerContext)
  const planner = planners.find((item) => item.id === plannerId)

  if (!planner) {
    return (
      <>
        <TopBar label="Trade planner" title={isLoading ? 'Loading…' : 'Not found'} />
        <div className={pageBody}>
          {!isLoading && (
            <section className="rounded-lg border border-dashed border-zinc-400/60 bg-white/50 p-10 text-center dark:border-white/[0.14] dark:bg-transparent">
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">This planner doesn&apos;t exist anymore.</p>
              <Link to="/" className="mt-2 inline-block text-xs font-medium text-sky-800 transition hover:underline dark:text-sky-300">
                Back to journals
              </Link>
            </section>
          )}
        </div>
      </>
    )
  }

  // keyed so switching planners resets the drawer and reloads the plans
  return <PlannerWorkspace key={planner.id} planner={planner} />
}

export default PlannerPage
