import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, CheckSquareIcon, CloseIcon, HashIcon, PlusIcon, TextIcon } from '../../../utils/Icons.jsx'
import { FIELD_TYPES, MAX_CUSTOM_FIELDS, MAX_STRATEGY_LENGTH, makeFieldKey, toFormField } from '../../../utils/customFields'
import { dateInputClass, ghostFooterButton, iconButtonClass, inputClass } from '../../common/formStyles'
import { dialogTextareaClass } from '../../profile/profileStyles'

const TYPE_ICONS = { text: TextIcon, number: HashIcon, date: CalendarIcon, checkbox: CheckSquareIcon }
const numberInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
// primary footer button look, minus its disabled:cursor-wait (that is what showed the loading cursor)
const saveButtonClass =
  'h-9 cursor-pointer rounded-md bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'
const SCOPE_OPTIONS = [
  { value: 'all', label: 'All trades', hint: 'Add these properties to trades you already logged too. Values they already have are kept.' },
  { value: 'future', label: 'New trades only', hint: 'Existing trades stay exactly as they are.' }
]
// The "Apply changes to" choice is remembered per journal (in this browser), so reopening the dialog starts from
// what you picked last time. It can be changed again at any time.
const scopeKey = (journalId) => `tradecommit:context-scope:${journalId}`
const readScope = (journalId) => {
  try {
    const saved = window.localStorage.getItem(scopeKey(journalId))
    return SCOPE_OPTIONS.some((option) => option.value === saved) ? saved : 'all'
  } catch {
    return 'all'
  }
}
const rememberScope = (journalId, scope) => {
  try {
    window.localStorage.setItem(scopeKey(journalId), scope)
  } catch {
    // storage unavailable (private mode): the choice just isn't remembered
  }
}
const labelInputClass =
  'h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] text-zinc-600 outline-none transition-colors placeholder:text-zinc-500 hover:bg-zinc-100/80 focus:bg-zinc-100 focus:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.06] dark:focus:text-zinc-100'

// what gets sent to (and compared with) the server copy
const toPayload = (strategy, attributes) => ({
  strategy: strategy.trim(),
  attributes: attributes.map((field) => ({
    key: field.key,
    type: field.type,
    label: String(field.label ?? '').trim() || FIELD_TYPES[field.type].label,
    value: field.type === 'checkbox' ? Boolean(field.value) : field.value ?? ''
  }))
})

function AttributeRow({ field, autoFocus, onChange, onRemove }) {
  const TypeIcon = TYPE_ICONS[field.type] ?? TextIcon
  const valueLabel = `${field.label || FIELD_TYPES[field.type].label} default value`

  return (
    <div className="group/row flex items-start gap-2 py-0.5">
      <div className="flex h-8 w-36 shrink-0 items-center gap-2 text-zinc-500 dark:text-zinc-400">
        <TypeIcon className="h-[15px] w-[15px] shrink-0" />
        <input
          value={field.label}
          onChange={(event) => onChange({ label: event.target.value })}
          autoFocus={autoFocus}
          aria-label="Property name"
          placeholder="Name"
          maxLength={40}
          autoComplete="off"
          className={labelInputClass}
        />
      </div>

      <div className="min-w-0 flex-1">
        {field.type === 'checkbox' ? (
          <div className="flex h-8 items-center px-2">
            <input
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={(event) => onChange({ value: event.target.checked })}
              aria-label={valueLabel}
              className="h-4 w-4 cursor-pointer rounded accent-zinc-700 dark:accent-zinc-300"
            />
          </div>
        ) : (
          <input
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            step={field.type === 'number' ? 'any' : undefined}
            value={field.value ?? ''}
            onChange={(event) => onChange({ value: event.target.value })}
            aria-label={valueLabel}
            autoComplete="off"
            placeholder="No default"
            className={field.type === 'number' ? numberInputClass : field.type === 'date' ? dateInputClass : inputClass}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        title="Remove property"
        aria-label={`Remove ${field.label || FIELD_TYPES[field.type].label} property`}
        className="flex h-8 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:opacity-100 md:opacity-0 md:group-hover/row:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-200"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * Modal for the journal's context: a free-text strategy description plus default properties
 * that every new trade form in this journal starts with.
 * `onSave(context, { applyToExisting })` returns a promise; `applyToExisting` says whether the default
 * properties are also added to trades that were logged before.
 * Rendered in a portal because the page header uses backdrop-blur, which would trap `fixed` children.
 */
function JournalContextDialog({ journalId, journalName, context, onSave, onClose }) {
  const [strategy, setStrategy] = useState(context?.strategy ?? '')
  const [attributes, setAttributes] = useState(() => (context?.attributes ?? []).map(toFormField))
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [focusKey, setFocusKey] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState(() => readScope(journalId)) // 'all' = also update existing trades, 'future' = new trades only
  const dialogRef = useRef(null)

  // Take focus off the "Context" button that opened this dialog. Otherwise it stays focused underneath, and
  // pressing Esc turns the browser's keyboard-focus ring on for it, so it keeps glowing after the dialog closes.
  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  const savedPayload = useMemo(() => JSON.stringify(toPayload(context?.strategy ?? '', (context?.attributes ?? []).map(toFormField))), [context])
  const isDirty = JSON.stringify(toPayload(strategy, attributes)) !== savedPayload

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && !isSaving && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onClose])

  const addAttribute = (type) => {
    if (attributes.length >= MAX_CUSTOM_FIELDS) return
    const key = makeFieldKey()
    setFocusKey(key)
    setAttributes((current) => [...current, { key, label: FIELD_TYPES[type].label, type, value: FIELD_TYPES[type].empty }])
    setTypeMenuOpen(false)
  }

  const changeAttribute = (key, patch) => {
    setAttributes((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)))
  }

  const removeAttribute = (key) => {
    setAttributes((current) => current.filter((field) => field.key !== key))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving || !isDirty) return

    setIsSaving(true)
    setError('')
    try {
      await onSave(toPayload(strategy, attributes), { applyToExisting: scope === 'all' })
      rememberScope(journalId, scope)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof TypeError ? "Can't reach the server. Check your connection and try again." : saveError.message || 'Could not save the context')
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Journal context"
        className="flex max-h-[90vh] outline-none w-full max-w-xl flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl dark:border-white/[0.14] dark:bg-panel"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">Journal context</h3>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{journalName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close" className={`${iconButtonClass} cursor-pointer disabled:opacity-50`}>
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="subtle-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-5 pt-3">
          <section>
            <label htmlFor="journal-strategy" className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Strategy</label>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Describe how you trade this journal. It is saved with the journal and gives future AI insights the background they need.
            </p>
            <textarea
              id="journal-strategy"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value)}
              maxLength={MAX_STRATEGY_LENGTH}
              rows={5}
              placeholder="e.g. Intraday breakouts on index futures. I trade the first 90 minutes only, risk 1% per trade and skip high-impact news days."
              className={dialogTextareaClass}
            />
            <p className="mt-1 text-right text-[11px] text-zinc-500 dark:text-zinc-400">{strategy.length}/{MAX_STRATEGY_LENGTH}</p>
          </section>

          <section>
            <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Default properties</p>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Added to every new trade in this journal, with the values you set here. You can still edit or remove them on any trade.
            </p>

            {attributes.map((field) => (
              <AttributeRow
                key={field.key}
                field={field}
                autoFocus={field.key === focusKey}
                onChange={(patch) => changeAttribute(field.key, patch)}
                onRemove={() => removeAttribute(field.key)}
              />
            ))}

            <div className="mt-1 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setTypeMenuOpen((open) => !open)}
                disabled={attributes.length >= MAX_CUSTOM_FIELDS}
                aria-expanded={typeMenuOpen}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Add property
              </button>

              {typeMenuOpen && Object.entries(FIELD_TYPES).map(([type, config]) => {
                const TypeIcon = TYPE_ICONS[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addAttribute(type)}
                    className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-300 px-2 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/[0.14] dark:text-zinc-200 dark:hover:bg-white/[0.07]"
                  >
                    <TypeIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    {config.label}
                  </button>
                )
              })}
            </div>

            <fieldset className="mt-4 rounded-lg border border-zinc-300 p-3 dark:border-white/[0.14]">
              <legend className="px-1 text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Apply changes to</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition-colors ${
                      scope === option.value
                        ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-white/[0.07]'
                        : 'border-zinc-300 hover:bg-zinc-50 dark:border-white/[0.14] dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="context-scope"
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-zinc-800 dark:accent-zinc-200"
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-zinc-500 dark:text-zinc-400">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-300 px-6 py-3 dark:border-white/[0.12]">
          <p role="alert" className="min-w-0 text-xs text-rose-600 dark:text-rose-400">{error}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className={`${ghostFooterButton} cursor-pointer disabled:opacity-50`}>Cancel</button>
            <button type="submit" disabled={!isDirty || isSaving} className={saveButtonClass}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </footer>
      </form>
    </div>,
    document.body
  )
}

export default JournalContextDialog