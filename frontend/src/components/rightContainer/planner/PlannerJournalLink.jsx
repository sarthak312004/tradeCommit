import { useContext, useState } from 'react'
import { journalContext, plannerContext } from '../../../context/Context'
import JournalPicker from '../../common/JournalPicker'

/**
 * Compact control to connect this planner to one existing journal. The AI mentor then reads the plans written
 * here next to the trades executed in that journal, so it knows what was planned when it reviews what was done.
 * Days without a plan, plans that never triggered and skipped plans are never treated as mistakes.
 */
function PlannerJournalLink({ planner }) {
  const { journals } = useContext(journalContext)
  const { updatePlanner } = useContext(plannerContext)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const options = journals.filter((journal) => !String(journal.id).startsWith('pending-'))
  const linked = options.find((journal) => journal.id === planner.linkedJournalId)

  const handleChange = async (journalId) => {
    setError('')
    setIsSaving(true)
    try {
      await updatePlanner(planner.id, { linkedJournalId: journalId || null })
    } catch (changeError) {
      setError(changeError instanceof TypeError ? "Can't reach the server. Check your connection and try again." : changeError.message || 'Could not connect the journal')
    } finally {
      setIsSaving(false)
    }
  }

  if (options.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        title="The AI mentor compares these plans with the trades you took in the connected journal. Days without a plan, plans that never triggered and skipped plans are not treated as mistakes."
      >
        Journal
      </span>
      <JournalPicker journals={options} value={linked?.id ?? ''} onChange={handleChange} disabled={isSaving} />
      {linked && <span className="hidden text-[11px] text-zinc-500 sm:inline dark:text-zinc-400">AI mentor compares your plans with these trades</span>}
      {error && <p role="alert" className="w-full text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  )
}

export default PlannerJournalLink
