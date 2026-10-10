import { useContext, useEffect, useRef, useState } from "react"
import { journalContext, plannerContext } from "../../context/Context"
import JournalPicker from "../common/JournalPicker"
import {
  CUSTOM_TYPE,
  DEFAULT_PLANNER_TYPE,
  MAX_PLANNER_NAME,
  MAX_PLANNER_TYPE,
  PLANNER_TYPE_PRESETS,
} from "../../utils/plannerTypes"
import {
  createCancelButton,
  createFieldLabel,
  createFormActions,
  createFormPanel,
  createFormTitle,
  createSubmitButton,
  createTextField,
} from "./sidebarStyles"

function PlannerCreateForm({ open, onClose }) {
  const { createPlanner } = useContext(plannerContext)
  const { journals } = useContext(journalContext)
  const [name, setName] = useState("")
  const [type, setType] = useState(DEFAULT_PLANNER_TYPE)
  const [customType, setCustomType] = useState("")
  const [linkedJournalId, setLinkedJournalId] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(id)
  }, [open])

  const reset = () => {
    setName("")
    setType(DEFAULT_PLANNER_TYPE)
    setCustomType("")
    setLinkedJournalId("")
    setError("")
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const plannerType = (type === CUSTOM_TYPE ? customType : type).trim()
    if (!trimmedName || !plannerType || isSaving) return

    setIsSaving(true)
    setError("")
    try {
      await createPlanner(trimmedName, plannerType, linkedJournalId || null)
      reset()
    } catch (submitError) {
      setError(submitError.message || "Could not create the planner")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={createFormPanel}>
      <p className={createFormTitle}>New trade planner</p>

      <div className="space-y-3">
        <div>
          <label htmlFor="planner-name" className={createFieldLabel}>Planner name</label>
          <input
            ref={inputRef}
            id="planner-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && reset()}
            placeholder="e.g. NIFTY setups"
            maxLength={MAX_PLANNER_NAME}
            autoComplete="off"
            readOnly={isSaving}
            className={createTextField}
          />
        </div>

        <div>
          <label htmlFor="planner-type" className={createFieldLabel}>Planner type</label>
          <select
            id="planner-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            disabled={isSaving}
            className={createTextField}
          >
            {PLANNER_TYPE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>{preset}</option>
            ))}
            <option value={CUSTOM_TYPE}>{CUSTOM_TYPE}</option>
          </select>
          {type === CUSTOM_TYPE && (
            <input
              id="planner-custom-type"
              type="text"
              value={customType}
              onChange={(event) => setCustomType(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && reset()}
              placeholder="e.g. Options"
              maxLength={MAX_PLANNER_TYPE}
              autoComplete="off"
              readOnly={isSaving}
              aria-label="Custom planner type"
              className={`${createTextField} mt-2`}
            />
          )}
        </div>

        {journals.length > 0 && (
          <div>
            <label className={createFieldLabel}>Connect to a journal <span className="font-normal opacity-70">(optional)</span></label>
            <JournalPicker
              variant="field"
              journals={journals.filter((journal) => !String(journal.id).startsWith("pending-"))}
              value={linkedJournalId}
              onChange={setLinkedJournalId}
              disabled={isSaving}
              emptyLabel="Not connected"
              ariaLabel="Connect to a journal"
            />
            <p className="mt-1.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
              The AI mentor then compares your plans with the trades you took in that journal.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className={createFormActions}>
        <button type="button" onClick={reset} disabled={isSaving} className={createCancelButton}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || !(type === CUSTOM_TYPE ? customType.trim() : type) || isSaving}
          className={createSubmitButton}
        >
          {isSaving ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  )
}

export default PlannerCreateForm
