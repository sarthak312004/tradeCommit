import { useContext, useState } from 'react'
import { Link, useParams } from 'react-router'
import { plannerContext } from '../context/Context'
import { usePlanEntries } from '../hooks/usePlanEntries'
import TopBar from '../components/rightContainer/TopBar'
import PlannerCalendar from '../components/rightContainer/planner/PlannerCalendar'
import PlanForm from '../components/rightContainer/planner/PlanForm'
import PlannerJournalLink from '../components/rightContainer/planner/PlannerJournalLink'

const pageBody = 'subtle-scrollbar flex-1 overflow-y-auto p-6 md:p-8'

function PlannerWorkspace({ planner }) {
  const { entries, isLoading, error, addEntry, updateEntry, removeEntry, uploadImage } = usePlanEntries(planner.id)
  // null = drawer closed, { entry: null, date } = new plan, { entry } = editing
  const [formState, setFormState] = useState(null)

  const handleSubmit = (values) =>
    formState.entry ? updateEntry(formState.entry.id, values) : addEntry(values)

  return (
    <>
      <TopBar label={`Trade planner · ${planner.type}`} title={planner.name} />
      <div className={pageBody}>
        <PlannerJournalLink planner={planner} />
        {error && <p role="alert" className="mb-4 text-sm text-rose-500">{error}</p>}
        {isLoading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading plans…</p>
        ) : (
          <PlannerCalendar
            entries={entries}
            selectedDate={formState?.entry?.date ?? formState?.date ?? null}
            onCreateForDate={(date) => setFormState({ entry: null, date })}
            onOpenEntry={(entry) => setFormState({ entry })}
          />
        )}
      </div>

      {formState && (
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
        />
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
