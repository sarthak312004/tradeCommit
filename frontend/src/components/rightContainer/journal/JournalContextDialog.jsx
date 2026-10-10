import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, CheckSquareIcon, CloseIcon, HashIcon, MaximizeIcon, MinimizeIcon, PlusIcon, TextIcon } from '../../../utils/Icons.jsx'
import { FIELD_TYPES, MAX_CUSTOM_FIELDS, MAX_STRATEGY_LENGTH, makeFieldKey, toFormField } from '../../../utils/customFields'
import { dateInputClass, ghostFooterButton, iconButtonClass, inputClass } from '../../common/formStyles'
import { cleanStrategy, richTextLength, strategyToHtml } from '../../../utils/richText'
import BasicRichTextEditor from '../../common/BasicRichTextEditor'

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
// Dialog size (normal / wide) is remembered in this browser too.
const WIDE_KEY = 'tradecommit:context-wide'
const readWide = () => {
  try {
    return window.localStorage.getItem(WIDE_KEY) === '1'
  } catch {
    return false
  }
}
const rememberWide = (isWide) => {
  try {
    window.localStorage.setItem(WIDE_KEY, isWide ? '1' : '0')
  } catch {
    // storage unavailable: the size just isn't remembered
  }
}
const labelInputClass =
  'h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[13px] text-zinc-600 outline-none transition-colors placeholder:text-zinc-500 hover:bg-zinc-100/80 focus:bg-zinc-100 focus:text-zinc-800 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.06] dark:focus:text-zinc-100'

// what gets sent to (and compared with) the server copy
const toPayload = (strategy, attributes) => ({
  strategy: cleanStrategy(strategy),
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
  // the strategy is rich text: older journals hold plain text, which is turned into paragraphs once, here
  const [initialStrategy] = useState(() => strategyToHtml(context?.strategy))
  const [strategy, setStrategy] = useState(initialStrategy)
  const [strategyLength, setStrategyLength] = useState(() => richTextLength(strategyToHtml(context?.strategy)))
  const [isWide, setIsWide] = useState(readWide)
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

  const savedPayload = useMemo(() => JSON.stringify(toPayload(strategyToHtml(context?.strategy), (context?.attributes ?? []).map(toFormField))), [context])
  const isDirty = JSON.stringify(toPayload(strategy, attributes)) !== savedPayload
  const isTooLong = strategyLength > MAX_STRATEGY_LENGTH

  // a long strategy is easy to lose with a stray Esc or click outside, so ask first when there are unsaved edits
  const requestClose = () => {
    if (isSaving) return
    if (isDirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }
  const closeRef = useRef(requestClose)
  useEffect(() => {
    closeRef.current = requestClose
  })

  const handleStrategyChange = useCallback((html, text) => {
    setStrategy(html)
    setStrategyLength(text.length)
  }, [])

  const toggleWide = () => {
    setIsWide((current) => {
      rememberWide(!current)
      return !current
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => event.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
    if (isSaving || !isDirty || isTooLong) return

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
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Journal context"
        className={`flex w-full flex-col rounded-2xl border border-zinc-300 bg-white shadow-2xl outline-none transition-[max-width] duration-200 dark:border-white/[0.14] dark:bg-panel ${
          isWide ? 'h-[92vh] max-w-6xl' : 'max-h-[90vh] max-w-2xl'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-[-0.03em] text-zinc-900 dark:text-zinc-100">Journal context</h3>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{journalName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleWide}
              title={isWide ? 'Smaller window' : 'Bigger window'}
              aria-label={isWide ? 'Make the window smaller' : 'Make the window bigger'}
              aria-pressed={isWide}
              className={`${iconButtonClass} hidden cursor-pointer md:flex`}
            >
              {isWide ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={requestClose} disabled={isSaving} aria-label="Close" className={`${iconButtonClass} cursor-pointer disabled:opacity-50`}>
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-3 ${isWide ? 'space-y-6 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0' : 'space-y-6'}`}>
          <section>
            <span id="journal-strategy-label" className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">Strategy</span>
            <p className="mb-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Describe how you trade this journal: entries, risk, stops, hours, what you skip. Use lists to keep rules easy to check. It is saved with the journal and gives AI insights the background they need.
            </p>
            <BasicRichTextEditor
              id="journal-strategy"
              labelledBy="journal-strategy-label"
              initialHtml={initialStrategy}
              onChange={handleStrategyChange}
              editorClassName={isWide ? 'min-h-[55vh]' : 'min-h-[260px]'}
              placeholder="e.g. Intraday breakouts on index futures. I trade the first 90 minutes only, risk 1% per trade and skip high-impact news days."
            />
            <p className={`mt-1 flex justify-between text-[11px] ${isTooLong ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
              <span>{isTooLong ? 'Too long. Shorten it to save.' : 'Drag the bottom-right corner of the box to make it taller.'}</span>
              <span className="tabular-nums">{strategyLength}/{MAX_STRATEGY_LENGTH}</span>
            </p>
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
            <button type="button" onClick={requestClose} disabled={isSaving} className={`${ghostFooterButton} cursor-pointer disabled:opacity-50`}>Cancel</button>
            <button type="submit" disabled={!isDirty || isSaving || isTooLong} className={saveButtonClass}>
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