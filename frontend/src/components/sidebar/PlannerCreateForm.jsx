import { useContext, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { plannerContext } from "../../context/Context"
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
  focusRing,
} from "./sidebarStyles"

const TYPE_OPTIONS = [...PLANNER_TYPE_PRESETS, CUSTOM_TYPE]

function PlannerCreateForm({ open, onClose }) {
  const { createPlanner } = useContext(plannerContext)
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [typeChoice, setTypeChoice] = useState(DEFAULT_PLANNER_TYPE)
  const [customType, setCustomType] = useState("")
  const [error, setError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef(null)
  const customInputRef = useRef(null)

  const isCustom = typeChoice === CUSTOM_TYPE
  const resolvedType = isCustom ? customType.trim() : typeChoice
  const canSubmit = name.trim() && resolvedType && !isSaving

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (isCustom) customInputRef.current?.focus({ preventScroll: true })
  }, [isCustom])

  const reset = () => {
    setName("")
    setTypeChoice(DEFAULT_PLANNER_TYPE)
    setCustomType("")
    setError("")
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return

    setIsSaving(true)
    setError("")
    try {
      const created = await createPlanner(name, resolvedType)
      reset()
      navigate(`/planner/${created.id}`)
    } catch (submitError) {
      setError(submitError.message || "Could not create the planner")
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (event) => event.key === "Escape" && reset()

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
            maxLength={MAX_PLANNER_NAME}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. NIFTY swing setup"
            autoComplete="off"
            className={createTextField}
          />
        </div>

        <fieldset>
          <legend className={createFieldLabel}>Planner type</legend>
          <div role="radiogroup" aria-label="Planner type" className="grid grid-cols-2 gap-1.5">
            {TYPE_OPTIONS.map((option) => {
              const active = typeChoice === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTypeChoice(option)}
                  onKeyDown={handleKeyDown}
                  className={`h-7 cursor-pointer rounded-md border px-2 text-[11px] font-medium transition-colors ${focusRing} ${
                    active
                      ? "border-zinc-400 bg-white text-zinc-900 shadow-sm dark:border-zinc-500 dark:bg-white/[0.1] dark:text-zinc-50"
                      : "border-zinc-200/80 bg-transparent text-zinc-500 hover:bg-white/70 dark:border-white/[0.08] dark:text-zinc-400 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </fieldset>

        {isCustom && (
          <div>
            <label htmlFor="planner-custom-type" className={createFieldLabel}>Custom type</label>
            <input
              ref={customInputRef}
              id="planner-custom-type"
              type="text"
              value={customType}
              maxLength={MAX_PLANNER_TYPE}
              onChange={(e) => setCustomType(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Options expiry"
              autoComplete="off"
              className={createTextField}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className={createFormActions}>
        <button type="button" onClick={reset} className={createCancelButton}>
          Cancel
        </button>
        <button type="submit" disabled={!canSubmit} className={createSubmitButton}>
          {isSaving ? "Creating…" : "Create"}
        </button>
      </div>
    </form>
  )
}

export default PlannerCreateForm
