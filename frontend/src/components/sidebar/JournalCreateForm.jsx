import { useContext, useEffect, useRef, useState } from "react"
import { journalContext } from "../../context/Context"
import { DEFAULT_CURRENCY } from "../../utils/currencies"
import CurrencyPicker from "./CurrencyPicker"
import {
  createCancelButton,
  createFieldLabel,
  createFormActions,
  createFormPanel,
  createFormTitle,
  createSubmitButton,
  createTextField,
} from "./sidebarStyles"

function JournalCreateForm({ open, onClose, onReopen }) {
  const { createJournal } = useContext(journalContext)
  const [name, setName] = useState("")
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [error, setError] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60)
    return () => clearTimeout(id)
  }, [open])

  const reset = () => {
    setName("")
    setCurrency(DEFAULT_CURRENCY)
    setError("")
    onClose()
  }

  // The form closes right away and the journal appears in the list straight away (see createJournal).
  // Only if the server rejects it do we bring the form back, with what the user typed and the reason.
  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return

    const submitted = { name: trimmedName, currency }
    reset()

    createJournal(submitted.name, submitted.currency).catch((submitError) => {
      setName(submitted.name)
      setCurrency(submitted.currency)
      setError(
        submitError instanceof TypeError
          ? "Can't reach the server. Check your connection and try again."
          : submitError.message || "Could not create the journal"
      )
      onReopen?.()
    })
  }

  return (
    <form onSubmit={handleSubmit} className={createFormPanel}>
      <p className={createFormTitle}>New journal</p>

      <div className="space-y-3">
        <div>
          <label htmlFor="journal-name" className={createFieldLabel}>Journal name</label>
          <input
            ref={inputRef}
            id="journal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && reset()}
            placeholder="e.g. Swing trades"
            autoComplete="off"
            className={createTextField}
          />
        </div>

        <div>
          <p className={createFieldLabel}>Base currency</p>
          <CurrencyPicker value={currency} onChange={setCurrency} onEscape={reset} />
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            Used for this journal&apos;s P&amp;L and can&apos;t be changed later.
          </p>
        </div>
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
        <button type="submit" disabled={!name.trim()} className={createSubmitButton}>
          Create
        </button>
      </div>
    </form>
  )
}

export default JournalCreateForm
